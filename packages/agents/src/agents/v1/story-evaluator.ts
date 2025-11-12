import { ToolLoopAgent, Output, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import type { StoryTestResultPayload } from '@app/db'

import { parseEnv } from '../../helpers/env'
import {
  createSearchCodeTool,
  SEARCH_CODE_AGENT_MODEL,
} from './search-code-tool'
import { createShareThoughtTool } from '../../tools/share-thought-tool'
import { Daytona } from '@daytonaio/sdk'
import {
  storyTestResultSchema,
  type StoryEvaluationAgentMetrics,
  type StoryEvaluationAgentOptions,
  type StoryEvaluationAgentResult,
  type StoryTestModelOutput,
} from '../schema'

const DEFAULT_STORY_MODEL = 'gpt-5-mini'
const DEFAULT_MAX_STEPS = 30
const STORY_EVALUATION_AGENT_ID = 'story-evaluation'

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

function buildStoryEvaluationInstructions(): string {
  // * Dedent does not work in this project
  return `
    You are an expert software QA engineer evaluating whether a user story is achievable given the current repository state.

    # How to perform your evaluation
    1. Break apart the story into meaningful steps that can be searched for in the codebase.
    2. With each step, use the provided tools to determine if the step is supported by code in the database.
    3. When you find a line of code that is relevant to the step, add it to the evidence list.
    4. Repeat for each step. Until you have a complete list of evidence for each step.
    
    # Evaluation Mindset
    - Treat the repository as the single source of truth.
    - Only mark a story as "passed" when concrete code evidence confirms that each step is implemented and functionally connected.
    - When supporting code is missing, incomplete, or ambiguous, mark the relevant step—and overall story—as "failed" and explain what is missing.
    - A step is "failed" if code exists but clearly contradicts or prevents the expected behavior.
    - If some steps succeed while others fail, the overall story must still be marked as "failed" and you must document both the successes and the gaps.
    
    # Schema
    \`\`\`
    ${JSON.stringify(storyTestResultSchema.shape, null, 2)}
    \`\`\`

    # Tools
    - **shareThought**: summarize your intent, plan next steps, and note important discoveries for human reviewers.
    - **searchCode**: provide a clear task, function, or content to find within the codebase.

    # When using searchCode
    - Include a clear intent phrase, e.g. "Find function definitions for handleLogin" or "Locate where password reset emails are sent."
    - After receiving results, verify code semantics by reading context or re-querying with more specific patterns.
    - Avoid redundant searches for the same concept once confirmed.

    # Evidence Definition
    - Evidence must be **executable code**, not just type definitions, comments, or unused utilities.
    - Each evidence item must include:
      - A meaningful note summarizing what this code does.
      - A file path and line range.
    - Prefer top-level functions, components, or effects that implement user-facing outcomes.
    - Format every evidence note as Markdown, beginning with a short bolded title followed by any supporting details.

    # Step Continuity
    - Maintain a mental map of dependencies between steps (e.g., "create user" must precede "log in user").
    - When a step depends on another, cross-reference evidence from earlier steps rather than duplicating it.

    # When to Stop
    - When every step is confirmed as satisfied or failed.
    - When sufficient verified evidence exists for every "passed" step.
    - Do not continue searching once a definitive conclusion is reached.

    # Rules
    - When status is not "running", you must provide analysis with an ordered evidence list showing exactly which files and line ranges support your conclusion.
    - Explanation should clearly state why the story passes or fails. Use concise language that a human reviewer can follow quickly.
    - Format the explanation in Markdown, starting with a concise heading-style title before providing supporting details (lists or paragraphs) as needed.
    - If available evidence is insufficient to decide, set the status to "fail" and describe exactly what is missing or uncertain.
    - Keep it short, factual, and time-ordered.
    - Output summaries in Markdown format so they render cleanly for humans. Use headings and bullet lists where they improve clarity.
    - Do not include internal thoughts in final output, instead use shareThought to describe your reasoning.
    - Each response must be a JSON object that matches the required schema. Do not include explanations outside of JSON.
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

  const searchCodeTool = await createSearchCodeTool({
    sandbox,
    repoName: options.repoName,
    model: openAiProvider(SEARCH_CODE_AGENT_MODEL),
  })

  const shareThoughtTool = createShareThoughtTool({
    storyName: options.storyName,
    repoId: options.repoId,
    runId: options.runId ?? null,
  })

  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS)

  const agent = new ToolLoopAgent({
    id: STORY_EVALUATION_AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildStoryEvaluationInstructions(),
    tools: {
      shareThought: shareThoughtTool,
      searchCode: searchCodeTool,
    },
    stopWhen: stepCountIs(maxSteps),
    output: Output.object({ schema: storyTestResultSchema }),
  })

  const prompt = buildStoryEvaluationPrompt(options)

  const result = await agent.generate({ prompt })

  // ! we get `AI_NoOutputGeneratedError: No output generated.` if we hit
  // ! our max steps limit.

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
