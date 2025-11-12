import { ToolLoopAgent, Output, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { Daytona } from '@daytonaio/sdk'

import type { StoryTestResultPayload } from '@app/db'

import { parseEnv } from '../../helpers/env'
import { createTerminalCommandTool } from '../../tools/terminal-command-tool'
import { createReadFileTool } from '../../tools/read-file-tool'
import {
  createResolveLibraryTool,
  createGetLibraryDocsTool,
} from '../../tools/context7-tool'
import { createLspTool } from '../../tools/lsp-tool'
import {
  storyTestResultSchema,
  type StoryEvaluationAgentMetrics,
  type StoryEvaluationAgentOptions,
  type StoryEvaluationAgentResult,
  type StoryTestModelOutput,
} from '../schema'
import { logger } from '@trigger.dev/sdk'

const DEFAULT_STORY_MODEL = 'gpt-5-mini'
const DEFAULT_MAX_STEPS = 40
const STORY_EVALUATION_AGENT_ID = 'story-evaluation-v2'

export function normalizeStoryTestResult(
  raw: StoryTestModelOutput,
  startedAt: Date,
  completedAt?: Date,
): StoryTestResultPayload {
  const completed = completedAt ?? new Date()
  const durationMs = completed.getTime() - startedAt.getTime()

  const analysisVersion = raw.analysis?.version ?? 1

  const normalizedStatus: StoryTestResultPayload['status'] =
    raw.status === 'running' ? 'error' : raw.status

  const analysis = raw.analysis
    ? {
        conclusion: raw.analysis.conclusion,
        explanation: raw.analysis.explanation,
        evidence: raw.analysis.evidence,
      }
    : null

  return {
    status: normalizedStatus,
    analysisVersion,
    analysis,
    startedAt: startedAt.toISOString(),
    completedAt: completed.toISOString(),
    durationMs,
  }
}

function buildStoryEvaluationInstructions(repoOutline: string): string {
  return `
You are an expert software QA engineer evaluating whether a user story is achievable given the current repository state.

# Role & Objective
Start off with no assumptions the provided user story is achievable, you must discover that for yourself by 
gathering, extensively searching, and evaluating source code to make an educated conclusion if the user story is properly and fully implemented.
You must search, verify, and extract file excerpts that prove each step of the story is satisfied.
If you find evidence that contradicts the user story, you must mark the story as "failed", include your discovery and explain your conclusion.

# How to Perform Your Evaluation
1. Break apart the story into meaningful, testable steps.
2. For each step, use the available tools to search for supporting code evidence extensively. Each step may require multiple pieces of discovery to be satisfied.
3. When you find relevant code, verify it by reading the file contents and understanding the context.
4. Record each piece of evidence with precise file paths and line ranges.
5. Continue until you have evaluated every step and can make a definitive conclusion.

# Evaluation Mindset
- False-positives are worse than false-negatives.
- Treat the repository as the single source of truth.
- Only mark a story as "passed" when concrete code evidence confirms that each step is implemented and functionally connected.
- When supporting code is missing, incomplete, or ambiguous, mark the story as "failed" and explain what is missing.
- If some steps succeed while others fail, the overall story must still be marked as "failed" and you must document both the successes and the gaps.
- Do not continue searching after you have traced through the code sufficiently enough to have high confidence in your conclusion per each step.

# Available Tools
- **terminalCommand**: Execute read-only shell commands (e.g., \`rg\`, \`fd\`, \`tree\`, \`git\`, \`grep\`, etc.) to search for code patterns, files, and symbols.
- **readFile**: Read the full contents of a file to verify context and extract precise code snippets.
- **resolveLibrary**: Resolve a library/package name to get its Context7 library ID. Use this when you need to understand how a specific library or framework works.
- **getLibraryDocs**: Fetch up-to-date documentation for a library using its Context7 ID. Use this after resolveLibrary to get detailed documentation about APIs, patterns, or features.
- **lsp**: Use the Language Server Protocol to list symbols in a file (\`documentSymbols\`) or discover symbols across the codebase (\`sandboxSymbols\`). Only supports TypeScript and Python sources.

# Working Rules & Search Strategy
- The terminal is **non-interactive** — never use commands that open editors or wait for input.
- Always append a \`.\` when using \`rg\` (e.g., \`rg pattern .\`).
- Refine and re-run searches until you find conclusive matches.
- Inspect files instead of guessing when uncertain.
- Assume \`terminalCommand\` returns stdout on success and a JSON object with \`exitCode\` and \`output\` on failure.
- When verifying code, read 10-20 lines before and after a match to confirm context if needed.
- Break the story into relevant code symbols, filenames, functions, or terms before searching.
- Use \`resolveLibrary\` and \`getLibraryDocs\` only when local patterns are unclear: resolve the Context7 ID, fetch the docs, and apply them to your evaluation.
- Extract only the **minimum viable snippet** that provides clear evidence, recording precise file paths and line ranges.
- Stop once you have enough verified evidence to reach a confident conclusion.
- Evidence must be **executable code**, not just type definitions, comments, or unused utilities.
- Maintain a mental map of dependencies between steps (e.g., "create user" must precede "log in user").
- When a step depends on another, cross-reference evidence from earlier steps rather than duplicating it.

# Schema
\`\`\`
${JSON.stringify(storyTestResultSchema.shape, null, 2)}
\`\`\`

# Rules
- When status is not "running", you must provide analysis with an ordered evidence list showing exactly which files and line ranges support your conclusion.
- Explanation should clearly state why the story passes or fails. Use concise language that a human reviewer can follow quickly.
- If available evidence is insufficient to decide, set the status to "fail" and describe exactly what is missing or uncertain.
- Keep it short, factual, and time-ordered.
- Output summaries in Markdown format, embedded in the JSON object, so they render cleanly for humans.
- Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.

# Repository Overview
Use this output to form an initial understanding of the repository layout, infer where relevant code might live, and guide your first searches.

${repoOutline}
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

  const terminalCommandTool = createTerminalCommandTool({
    sandbox,
    repoName: options.repoName,
  })

  const readFileTool = createReadFileTool({
    sandbox,
    repoName: options.repoName,
  })

  const resolveLibraryTool = createResolveLibraryTool({
    apiKey: env.CONTEXT7_API_KEY,
  })

  const getLibraryDocsTool = createGetLibraryDocsTool({
    apiKey: env.CONTEXT7_API_KEY,
  })

  const lspTool = createLspTool({
    sandbox,
    repoName: options.repoName,
  })

  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS)
  const telemetryMetadata: Record<string, string> = {
    storyName: options.storyName,
    repoId: options.repoId,
    repoName: options.repoName,
    daytonaSandboxId: options.daytonaSandboxId,
    modelId: effectiveModelId,
  }

  if (options.runId) {
    telemetryMetadata.runId = options.runId
  }

  const telemetryEnabled = options.telemetryTracer !== undefined

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(outline),
    tools: {
      terminalCommand: terminalCommandTool,
      readFile: readFileTool,
      resolveLibrary: resolveLibraryTool,
      getLibraryDocs: getLibraryDocsTool,
      lsp: lspTool,
    },
    experimental_telemetry: telemetryEnabled
      ? {
          isEnabled: true,
          functionId: STORY_EVALUATION_AGENT_ID,
          metadata: telemetryMetadata,
          tracer: options.telemetryTracer,
        }
      : undefined,
    stopWhen: stepCountIs(maxSteps),
    onFinish: (result) => {
      logger.debug('🌸 Agent Result', { result })
    },
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

  const normalizedStatus: StoryTestModelOutput['status'] =
    parsedOutput.status === 'running' ? 'error' : parsedOutput.status

  const outputWithAnalysis: StoryTestModelOutput = {
    ...parsedOutput,
    status: normalizedStatus,
    analysis:
      parsedOutput.status === 'running'
        ? null
        : (parsedOutput.analysis ?? {
            version: 1,
            conclusion:
              normalizedStatus === 'error' ? 'error' : normalizedStatus,
            explanation:
              '**Summary unavailable.** Model did not supply analysis; TODO: summarize complete findings later.',
            evidence: [],
          }),
  }

  return {
    output: outputWithAnalysis,
    metrics,
    finishReason: result.finishReason,
  }
}
