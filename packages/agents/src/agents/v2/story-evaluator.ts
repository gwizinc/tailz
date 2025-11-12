import { ToolLoopAgent, Output, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { logger } from '@trigger.dev/sdk'
import { Daytona } from '@daytonaio/sdk'

import type { StoryTestResultPayload } from '@app/db'

import { parseEnv } from '../../helpers/env'
import { createTerminalCommandTool } from '../../tools/terminal-command-tool'
import { createReadFileTool } from '../../tools/read-file-tool'
import {
  createResolveLibraryTool,
  createGetLibraryDocsTool,
} from '../../tools/context7-tool'
import {
  storyTestResultSchema,
  type StoryEvaluationAgentMetrics,
  type StoryEvaluationAgentOptions,
  type StoryEvaluationAgentResult,
  type StoryTestModelOutput,
} from '../schema'

const DEFAULT_STORY_MODEL = 'gpt-5-mini'
const DEFAULT_MAX_STEPS = 30
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
We do not know if the user story provided is successful or not based on the code trace, that is your job to determine.
Don't assume the story should work; instead search for evidence. You have access to the entire codebase and the tools to search it.

# Role & Objective
Your job is to determine if a user story is implemented by locating and verifying precise code evidence within the repository.
You must search, verify, and extract exact file excerpts that prove each step of the story is satisfied.

# How to Perform Your Evaluation
1. Break apart the story into meaningful, testable steps.
2. For each step, use the available tools to search for supporting code evidence.
3. When you find relevant code, verify it by reading the file contents and understanding the context.
4. Record each piece of evidence with precise file paths and line ranges.
5. Continue until you have evaluated every step and can make a definitive conclusion.

# Evaluation Mindset
- Treat the repository as the single source of truth.
- Only mark a story as "passed" when concrete code evidence confirms that each step is implemented and functionally connected.
- When supporting code is missing, incomplete, or ambiguous, mark the story as "failed" and explain what is missing.
- A step is "failed" if code exists but clearly contradicts or prevents the expected behavior.
- If some steps succeed while others fail, the overall story must still be marked as "failed" and you must document both the successes and the gaps.
- Do not continue searching after you have sufficient verified evidence to make a conclusion.

# Available Tools
- **terminalCommand**: Execute read-only shell commands (e.g., \`rg\`, \`fd\`, \`tree\`, \`git\`, \`grep\`, etc.) to search for code patterns, files, and symbols.
- **readFile**: Read the full contents of a file to verify context and extract precise code snippets.
- **resolveLibrary**: Resolve a library/package name to get its Context7 library ID. Use this when you need to understand how a specific library or framework works.
- **getLibraryDocs**: Fetch up-to-date documentation for a library using its Context7 ID. Use this after resolveLibrary to get detailed documentation about APIs, patterns, or features.

# Working Rules
- The terminal is **non-interactive** — never use commands that open editors or wait for input.
- Always include the \`.\` path in search commands (e.g., \`rg pattern .\`).
- Refine and re-run searches until you find conclusive matches.
- **Inspect files instead of guessing** when uncertain.
- Prefer commands that surface **recently edited** files (e.g., \`rg --sortr=modified\`, \`fd <pattern> -X ls -t\`).
- Explore git history or dependencies when helpful (e.g., \`rg -u\`, \`fd -I\`).
- Assume \`terminalCommand\` returns:
  - stdout on success
  - a JSON object with \`exitCode\` and \`output\` on failure
- When verifying code, read 10-20 lines before and after a match to confirm context if needed.

# Search Strategy
1. Break down the story into relevant code symbols, filenames, functions, or terms.
2. Use \`terminalCommand\` with \`rg\`, \`fd\`, or similar tools to locate likely matches.
3. Use \`readFile\` to open and verify key sections.
4. If you encounter unfamiliar libraries or need to understand framework-specific patterns:
   - Use \`resolveLibrary\` to get the library's Context7 ID
   - Use \`getLibraryDocs\` to fetch relevant documentation
   - Apply this knowledge to verify if the code follows correct patterns
5. Extract only the **minimum viable snippet** that provides clear evidence.
6. Record precise file paths and line ranges in your evidence.
7. Use \`shareThought\` to document your reasoning and progress.
8. When confident in your conclusion, stop searching and provide your final analysis.

# Evidence Definition
- Evidence must be **executable code**, not just type definitions, comments, or unused utilities.
- Each evidence item must include:
  - A meaningful note summarizing what this code does.
  - A file path and line range.
- Prefer top-level functions, components, or effects that implement user-facing outcomes.

# Step Continuity
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
- Output summaries in Markdown format so they render cleanly for humans.
- Do not include internal thoughts in final output, instead use shareThought to describe your reasoning.
- Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.

# Repository Overview
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

  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS)

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(outline),
    tools: {
      terminalCommand: terminalCommandTool,
      readFile: readFileTool,
      resolveLibrary: resolveLibraryTool,
      getLibraryDocs: getLibraryDocsTool,
    },
    stopWhen: stepCountIs(maxSteps),
    output: Output.object({ schema: storyTestResultSchema }),
  })

  const prompt = buildStoryEvaluationPrompt(options)

  const result = await agent.generate({ prompt })

  logger.info('Story evaluation agent v2 completed run', {
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
