import { ToolLoopAgent, Output, stepCountIs, type FinishReason } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { logger } from '@trigger.dev/sdk'
import { z } from 'zod'

import type {
  StoryAnalysisEvidenceReference,
  StoryTestResultPayload,
} from '@app/db'

import { parseEnv } from '@/helpers/env'
import { createSemanticCodeSearchTool, createSymbolLookupTool } from '@/tools'

const DEFAULT_STORY_MODEL = 'gpt-4o-mini'
const DEFAULT_MAX_STEPS = 30
const STORY_EVALUATION_AGENT_ID = 'story-evaluation'

const evidenceItemSchema = z.object({
  filePath: z.string(),
  startLine: z.number().int().min(0).nullable().optional(),
  endLine: z.number().int().min(0).nullable().optional(),
  note: z.string().nullish(),
})

const storyAnalysisSchema = z.object({
  version: z.literal(1),
  conclusion: z.enum(['pass', 'fail', 'blocked']),
  explanation: z.string().min(1),
  evidence: z.array(evidenceItemSchema).default([]),
})

const storyTestResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'blocked', 'running']).default('running'),
  analysis: storyAnalysisSchema.nullable().default(null),
})

type StoryTestModelOutput = z.infer<typeof storyTestResultSchema>

interface StoryEvaluationAgentOptions {
  storyName: string
  storyText: string
  repoId: string
  repoName: string
  branchName: string
  commitSha?: string | null
  runId?: string | null
  maxSteps?: number
  modelId?: string
}

interface StoryEvaluationAgentMetrics {
  stepCount: number
  toolCallCount: number
}

export interface StoryEvaluationAgentResult {
  output: StoryTestModelOutput
  metrics: StoryEvaluationAgentMetrics
  finishReason: FinishReason
}

function summarizeText(text: string | undefined, maxLength = 280): string | undefined {
  if (!text) {
    return undefined
  }

  const trimmed = text.trim()

  if (!trimmed) {
    return undefined
  }

  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1)}…`
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T
}

export function normalizeStoryTestResult(
  raw: StoryTestModelOutput,
  startedAt: Date,
  completedAt?: Date,
): StoryTestResultPayload {
  const completed = completedAt ?? new Date()
  const durationMs = completed.getTime() - startedAt.getTime()

  const analysisVersion = raw.analysis?.version ?? 1

  const analysis = raw.analysis
    ? {
        conclusion: raw.analysis.conclusion,
        explanation: raw.analysis.explanation,
        evidence: raw.analysis.evidence.map<StoryAnalysisEvidenceReference>(
          (item) => ({
            filePath: item.filePath,
            startLine: item.startLine ?? null,
            endLine: item.endLine ?? null,
            note: item.note ?? null,
          }),
        ),
      }
    : null

  return {
    status: raw.status,
    analysisVersion,
    analysis,
    startedAt: startedAt.toISOString(),
    completedAt: completed.toISOString(),
    durationMs,
  }
}

function buildStoryEvaluationInstructions(): string {
  // * Dedent does not work in this project
  return `
    You are an expert software QA engineer evaluating whether a user story is achievable given the current repository state.

    # How to perform your evaluation
    1. Break apart the story into meaningful steps that can be searched for in the codebase.
    2. With each step, use the provided tools to review and walk-through the codebase to determine if the step is possible to achieve.
    3. When you find a line of code that is relevant to the step, add it to the evidence list.
    4. Repeat for each step. Until you have a complete list of evidence for each step.
    
    # Important
    - Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.
    
    # Schema
    \`\`\`
    ${JSON.stringify(storyTestResultSchema.shape, null, 2)}
    \`\`\`

    # Tools
    - Call the "semanticCodeSearch" tool whenever you need additional code or repository information.
    - Call the "symbolLookup" tool whenever you need to locate a specific symbol or identifier in the codebase.

    # Rules
    - When status is not "running", you must provide analysis with an ordered evidence list showing exactly which files and line ranges support your conclusion.
    - Explanation should clearly state why the story passes, fails, or is blocked. Use concise language that a human reviewer can follow quickly.
    - If available evidence is insufficient to decide, mark the status as "blocked" and describe what is missing in the explanation.
    `
}

function buildStoryEvaluationPrompt(
  options: StoryEvaluationAgentOptions,
): string {
  const lines: string[] = [
    `Story Name: ${options.storyName}`,
    'Story Definition:',
    options.storyText,
  ]

  if (options.runId) {
    lines.push(`Run Identifier: ${options.runId}`)
  }

  lines.push(
    'When your analysis is complete, respond only with the JSON object that matches the schema.',
  )

  return lines.join('\n\n')
}

export async function runStoryEvaluationAgent(
  options: StoryEvaluationAgentOptions,
): Promise<StoryEvaluationAgentResult> {
  const env = parseEnv()
  const openAiProvider = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const effectiveModelId = DEFAULT_STORY_MODEL

  const semanticCodeSearch = createSemanticCodeSearchTool({
    repoId: options.repoId,
    branch: options.branchName,
  })

  const symbolLookup = createSymbolLookupTool({
    repoId: options.repoId,
    branch: options.branchName,
  })

  let stepIndex = 0

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(),
    tools: {
      // TODO add new tool for specific file lookup
      semanticCodeSearch,
      symbolLookup,
    },
    // TODO: surface stopWhen tuning once we gather additional telemetry from longer stories.
    stopWhen: stepCountIs(
      Math.max(1, (options.maxSteps ?? DEFAULT_MAX_STEPS) + 1),
    ),
    output: Output.object({ schema: storyTestResultSchema }),
    onStepFinish: (step) => {
      stepIndex += 1

      const toolCalls = step.toolCalls.length
        ? step.toolCalls.map((toolCall) =>
            omitUndefined({
              id: toolCall.toolCallId,
              name: toolCall.toolName,
              input: toolCall.input,
              dynamic: 'dynamic' in toolCall ? toolCall.dynamic : undefined,
              invalid: 'invalid' in toolCall ? toolCall.invalid : undefined,
            }),
          )
        : undefined

      const toolResults = step.toolResults.length
        ? step.toolResults.map((result) =>
            omitUndefined({
              id: result.toolCallId,
              name: result.toolName,
              output: result.output,
              dynamic: 'dynamic' in result ? result.dynamic : undefined,
              preliminary:
                'preliminary' in result ? result.preliminary : undefined,
            }),
          )
        : undefined

      logger.info('Story evaluation agent step finished',
        omitUndefined({
          storyName: options.storyName,
          repoId: options.repoId,
          runId: options.runId ?? undefined,
          step: stepIndex,
          finishReason: step.finishReason,
          reasoning: summarizeText(step.reasoningText),
          response: summarizeText(step.text),
          toolCalls,
          toolResults,
          usage: step.usage,
        }),
      )
    },
  })

  const prompt = buildStoryEvaluationPrompt(options)

  const result = await agent.generate({ prompt })

  // ! we get `AI_NoOutputGeneratedError: No output generated.` if we hit
  // ! our max steps limit.

  logger.info('Story evaluation agent completed run', {
    storyName: options.storyName,
    repoId: options.repoId,
    runId: options.runId ?? undefined,
    stepCount: result.steps.length,
    finishReason: result.finishReason,
  })

  const parsedOutput = storyTestResultSchema.parse(result.output)
  const toolCallCount = result.steps.reduce(
    (count, step) => count + step.toolCalls.length,
    0,
  )

  const metrics: StoryEvaluationAgentMetrics = {
    stepCount: result.steps.length,
    toolCallCount,
  }

  const conclusion =
    parsedOutput.status === 'running' ? 'blocked' : parsedOutput.status

  const outputWithAnalysis: StoryTestModelOutput =
    parsedOutput.status === 'running'
      ? {
          ...parsedOutput,
          analysis: null,
        }
      : {
          ...parsedOutput,
          analysis: parsedOutput.analysis ?? {
            version: 1,
            conclusion,
            explanation:
              'Model did not supply analysis - TODO use AI to summarize complete findings later.',
            evidence: [],
          },
        }

  return {
    output: outputWithAnalysis,
    metrics,
    finishReason: result.finishReason,
  }
}
