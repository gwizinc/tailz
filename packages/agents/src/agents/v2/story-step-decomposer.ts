import { ToolLoopAgent, Output, stepCountIs, type FinishReason } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import type { Tracer } from '@opentelemetry/api'

import { parseEnv } from '../../helpers/env'

const DEFAULT_MODEL = 'gpt-5-mini'
const DEFAULT_MAX_STEPS = 12
const AGENT_ID = 'story-step-decomposer-v1'

const storyStepsSchema = z.object({
  steps: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(320),
    )
    .min(1),
})

export type StoryStepDecomposerAgentOptions = {
  story: string
  repoFullName: string
  repoDescription?: string | null
  repoDefaultBranch?: string | null
  telemetryTracer?: Tracer
  modelId?: string
  maxSteps?: number
}

export type StoryStepDecomposerAgentResult = {
  steps: string[]
  finishReason: FinishReason
  metrics: {
    stepCount: number
    toolCallCount: number
  }
}

function buildInstructions(options: {
  repoFullName: string
  repoDescription?: string | null
  repoDefaultBranch?: string | null
}): string {
  const description = options.repoDescription
    ? `Repository overview: ${options.repoDescription}`
    : 'Repository overview: (not provided)'

  const defaultBranch = options.repoDefaultBranch
    ? `Default branch: ${options.repoDefaultBranch}`
    : undefined

  return `
You are an expert software QA analyst tasked with interpreting a plain-language user story into a clear, verifiable sequence of factual steps.

# Objective
- Break the story into concise, objective statements that describe what must be true for the story to be considered valid.
- Focus on the intended user experience and observable system behaviour.
- Avoid implementation details, internal variable names, or file paths.

# Kyoto Context
- Repository: ${options.repoFullName}
- ${description}
${defaultBranch ? `- ${defaultBranch}\n` : ''}
- Treat Kyoto's product principles of clarity, verification, and reviewer empathy as guiding values.

# Resources Available
- Read-only code search and terminal commands.
- File inspection tools for understanding structure and behaviour.
- Context7 library documentation queries for external dependencies.
Use these tools only to inform your reasoning. Do not cite identifiers, components, or file paths by name in the final output.

# Output Rules
- Respond with JSON that matches the schema {"steps": string[]}.
- Provide steps in sequential order that a human reviewer can agree constitute factual acceptance criteria.
- Each step must be a standalone, verifiable condition written in plain language.
- Avoid ambiguous language ("maybe", "should") and avoid referencing internal implementation specifics.
- Prefer statements that start with the actor or system component being validated.

# Working Method
1. Understand the actors, trigger, and desired outcomes expressed in the story.
2. Identify preconditions, user actions, and expected system responses.
3. Merge overlapping ideas and keep each step laser-focused on a single verifiable fact.
4. Use neutral, review-ready language that any stakeholder can evaluate without reading source code.

Return only valid JSON with the prescribed schema.`
}

function buildPrompt(story: string): string {
  return [
    'Interpret the following user story and produce the ordered list of factual acceptance criteria.',
    '',
    'User Story:',
    story.trim(),
  ].join('\n')
}

export async function runStoryStepDecomposerAgent(
  options: StoryStepDecomposerAgentOptions,
): Promise<StoryStepDecomposerAgentResult> {
  const env = parseEnv()

  const openAiProvider = createOpenAI({ apiKey: env.OPENAI_API_KEY })
  const effectiveModelId = options.modelId ?? DEFAULT_MODEL

  const maxSteps = Math.max(1, options.maxSteps ?? DEFAULT_MAX_STEPS)

  const telemetryMetadata: Record<string, string> = {
    repoFullName: options.repoFullName,
    modelId: effectiveModelId,
  }

  const telemetryEnabled = options.telemetryTracer !== undefined

  const agent = new ToolLoopAgent({
    id: AGENT_ID,
    model: openAiProvider(effectiveModelId),
    instructions: buildInstructions(options),
    tools: {},
    stopWhen: stepCountIs(maxSteps),
    experimental_telemetry: telemetryEnabled
      ? {
          isEnabled: true,
          functionId: AGENT_ID,
          metadata: telemetryMetadata,
          tracer: options.telemetryTracer,
        }
      : undefined,
    output: Output.object({ schema: storyStepsSchema }),
  })

  const result = await agent.generate({ prompt: buildPrompt(options.story) })

  const parsedOutput = storyStepsSchema.parse(result.output)

  const metrics = {
    stepCount: result.steps.length,
    toolCallCount: result.steps.reduce(
      (count, step) => count + step.toolCalls.length,
      0,
    ),
  }

  return {
    steps: parsedOutput.steps,
    finishReason: result.finishReason,
    metrics,
  }
}
