import { ToolLoopAgent, Output, stepCountIs, type FinishReason } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

import type {
  StoryAnalysisEvidenceReference,
  StoryTestResultPayload,
} from '@app/db'

import { createSearchCodeTool, type SearchCodeTool } from '@/tools/search-code'
import { parseEnv } from '@/helpers/env'

const DEFAULT_STORY_MODEL = 'gpt-4o-mini'
const DEFAULT_MAX_STEPS = 6
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
  branchName?: string | null
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
    You are an expert software QA engineer evaluating whether a user story can be executed with the current repository state.
    
    # Important
    - Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.
    
    # Schema
    \`\`\`
    ${JSON.stringify(storyTestResultSchema.shape, null, 2)}
    \`\`\`

    # Tools
    - Call the "codeSearch" tool whenever you need additional code or repository information.

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

  const codeSearchTool = createSearchCodeTool({
    repoId: options.repoId,
    commitSha: options.commitSha ?? null,
  })
  // TODO add new tool for specific file lookup
  // TODO add new tool for specific symbol lookup

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(),
    tools: {
      codeSearch: codeSearchTool,
    },
    // TODO: surface stopWhen tuning once we gather additional telemetry from longer stories.
    stopWhen: stepCountIs(
      Math.max(1, (options.maxSteps ?? DEFAULT_MAX_STEPS) + 1),
    ),
    output: Output.object({ schema: storyTestResultSchema }),
  })

  const prompt = buildStoryEvaluationPrompt(options)

  const result = await agent.generate({ prompt })

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
