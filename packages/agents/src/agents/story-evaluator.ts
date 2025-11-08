/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { ToolLoopAgent, Output, stepCountIs, type FinishReason } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { logger } from '@trigger.dev/sdk'
import { z } from 'zod'

import type {
  StoryAnalysisEvidenceReference,
  StoryTestResultPayload,
} from '@app/db'

import { parseEnv } from '../helpers/env'
import { createTerminalCommandTool } from '../tools/terminal-command-tool'
import { createShareThoughtTool } from '../tools/share-thought-tool'
import { Daytona } from '@daytonaio/sdk'
import { createReadFileTool } from '../tools/read-file-tool'

const DEFAULT_STORY_MODEL = 'gpt-5-mini'
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
  daytonaSandboxId: string
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

function buildStoryEvaluationInstructions(args: { outline: string }): string {
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
    - Call the "shareThought" tool frequently to summarize your intent, plan next steps, and note important discoveries for human reviewers.
    - Call the "sandboxCommand" tool to execute read-only shell commands (like ripgrep) in the Daytona sandbox for direct repository inspection.
    - Call the "readFile" tool to read the contents of a file from the Daytona sandbox workspace.

    ## Advice
    - Use flags to order results by most recently edited so you are more likely to find the most relevant code/file when there are many candidates.
      - Eg: \`rg --sortr=modified\` or \`fd <pattern> -X ls -t\`
    - Use git history/blame and commit messages to understand the historical context of the code.
    - Use git history to identify file edit co-occurrences to ensure you are not missing any relevant code.

    # Rules
    - When status is not "running", you must provide analysis with an ordered evidence list showing exactly which files and line ranges support your conclusion.
    - Explanation should clearly state why the story passes, fails, or is blocked. Use concise language that a human reviewer can follow quickly.
    - If available evidence is insufficient to decide, mark the status as "blocked" and describe what is missing in the explanation.

    # Repo Outline
    ${args.outline}
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

  const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })
  const sandbox = await daytona.get(options.daytonaSandboxId)

  const repoOutline = await sandbox.process.executeCommand(
    'tree -L 3',
    `workspace/${options.repoName}`,
  )
  if (repoOutline.exitCode !== 0) {
    throw new Error(`Failed to get repo outline: ${repoOutline.result}`)
  }
  const outline = repoOutline.result ?? ''
  console.log('🔍 Outline generated', { outline })

  const terminalCommandTool = createTerminalCommandTool({
    sandbox,
    repoName: options.repoName,
  })
  const shareThoughtTool = createShareThoughtTool({
    storyName: options.storyName,
    repoId: options.repoId,
    runId: options.runId ?? null,
  })

  const readFileTool = createReadFileTool({
    sandbox,
    repoName: options.repoName,
  })

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions({ outline }),
    tools: {
      shareThought: shareThoughtTool,
      terminalCommand: terminalCommandTool,
      readFile: readFileTool,
    },
    // TODO: surface stopWhen tuning once we gather additional telemetry from longer stories.
    stopWhen: stepCountIs(
      Math.max(1, (options.maxSteps ?? DEFAULT_MAX_STEPS) + 1),
    ),
    output: Output.object({ schema: storyTestResultSchema }),
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
