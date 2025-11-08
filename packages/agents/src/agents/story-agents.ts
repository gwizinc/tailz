/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { Output, ToolLoopAgent, type LanguageModel, stepCountIs } from 'ai'

import {
  reviewerInputSchema,
  stepReviewerOutputSchema,
  storyDirectorPlanSchema,
  type ReviewerInput,
  type StepReviewerOutput,
  type StoryDirectorPlan,
  type StoryStep,
} from './schemas'

import {
  createSemanticCodeSearchTool,
  createSymbolLookupTool,
  type SearchContext,
} from '../tools'

const STEP_REVIEWER_AGENT_ID = 'step-reviewer-agent'
const STORY_DIRECTOR_AGENT_ID = 'story-director-agent'

interface StepReviewerAgentConfig extends SearchContext {
  model: LanguageModel
  maxSteps?: number
}

interface StoryDirectorAgentConfig {
  model: LanguageModel
  maxSteps?: number
}

function buildStepReviewerInstructions(): string {
  return `You are an autonomous QA assistant responsible for validating a single atomic user-story step.

Follow this workflow:
1. Review the step description and any prior step outcomes.
2. Use the provided search tools to inspect the repository for supporting implementation or missing behaviour.
3. Summarize your findings and return a JSON payload matching the required schema.

Rules:
- Prefer the fuzzy search tool for broad discovery and the symbol search tool for exact identifiers.
- Provide concrete file paths and line ranges when referencing evidence.
- If the repository lacks support for the step, return "not-implemented". Use "blocked" if prerequisite data is missing.
- Never hallucinate file paths or code snippets.
- Respond with pure JSON only.`
}

function buildStepReviewerPrompt(input: ReviewerInput, story: string): string {
  const priorDescriptions = input.priorSteps.map((prior, index) => {
    return `Step ${index + 1}: ${prior.description} -> ${prior.result}`
  })

  const priorSection = priorDescriptions.length
    ? priorDescriptions.join('\n')
    : 'None'

  return [
    `Story: ${story}`,
    `Current Step (${input.step.index + 1}): ${input.step.description}`,
    'Prior Step Outcomes:',
    priorSection,
    'Respond with valid JSON matching the schema.',
  ].join('\n\n')
}

export interface StepReviewerAgentResult {
  output: StepReviewerOutput
  toolCalls: number
  stepsExecuted: number
}

export async function runStepReviewerAgent(
  config: StepReviewerAgentConfig,
  story: string,
  input: ReviewerInput,
): Promise<StepReviewerAgentResult> {
  const validatedInput = reviewerInputSchema.parse(input)

  const semanticCodeSearchTool = createSemanticCodeSearchTool(config)
  const symbolLookupTool = createSymbolLookupTool(config)

  const agent = new ToolLoopAgent({
    id: STEP_REVIEWER_AGENT_ID,
    model: config.model,
    instructions: buildStepReviewerInstructions(),
    tools: {
      semanticCodeSearch: semanticCodeSearchTool,
      symbolLookup: symbolLookupTool,
    },
    output: Output.object({ schema: stepReviewerOutputSchema }),
    stopWhen: stepCountIs(Math.max(4, (config.maxSteps ?? 12) + 1)),
  })

  const runResult = await agent.generate({
    prompt: buildStepReviewerPrompt(validatedInput, story),
  })

  const parsedOutput = stepReviewerOutputSchema.parse(runResult.output)
  const toolCalls = runResult.steps.reduce(
    (count, step) => count + step.toolCalls.length,
    0,
  )

  return {
    output: parsedOutput,
    toolCalls,
    stepsExecuted: runResult.steps.length,
  }
}

function buildDirectorPlanInstructions(): string {
  return `You are the Story Director agent. Convert a user story or natural language request into the smallest possible ordered steps.

Guidelines:
- Each step must be independently verifiable in the codebase.
- Steps should reference concrete actions, data flows, or UI behaviour.
- Keep the description concise and actionable.
- Provide stable string identifiers for each step using a short kebab-case slug (e.g. "step-1-send-request").
- Return JSON only, following the provided schema.`
}

function buildDirectorPlanPrompt(story: string): string {
  return [
    'Decompose the following story into atomic steps. Do not inspect the repository.',
    story,
    'Output must match the required JSON schema.',
  ].join('\n\n')
}

interface StoryDirectorPlanResult {
  plan: StoryDirectorPlan
  stepsExecuted: number
}

export async function runStoryDirectorPlanAgent(
  config: StoryDirectorAgentConfig,
  story: string,
): Promise<StoryDirectorPlanResult> {
  const agent = new ToolLoopAgent({
    id: STORY_DIRECTOR_AGENT_ID,
    model: config.model,
    instructions: buildDirectorPlanInstructions(),
    tools: {},
    output: Output.object({ schema: storyDirectorPlanSchema }),
    stopWhen: stepCountIs(Math.max(4, (config.maxSteps ?? 10) + 1)),
  })

  const runResult = await agent.generate({
    prompt: buildDirectorPlanPrompt(story),
  })

  const parsedPlan = storyDirectorPlanSchema.parse(runResult.output)

  return {
    plan: parsedPlan,
    stepsExecuted: runResult.steps.length,
  }
}

interface StoryDirectorAggregateInput {
  story: string
  steps: StepReviewerOutput[]
}

interface StoryDirectorAggregateResult {
  summary: string
  conclusion: StepReviewerOutput['result']
}

function determineStoryConclusion(
  steps: StepReviewerOutput[],
): StepReviewerOutput['result'] {
  const results = steps.map((step) => step.result)

  if (results.includes('fail')) {
    return 'fail'
  }

  if (results.includes('blocked')) {
    return 'blocked'
  }

  if (results.includes('not-implemented')) {
    return 'not-implemented'
  }

  return 'pass'
}

function buildAggregatedSummary(input: StoryDirectorAggregateInput): string {
  const bulletPoints = input.steps.map((step, index) => {
    return `Step ${index + 1} (${step.result}): ${step.description}`
  })

  return [
    `Story evaluation for: ${input.story}`,
    'Step outcomes:',
    bulletPoints.join('\n'),
  ].join('\n\n')
}

export function aggregateStoryOutcome(
  input: StoryDirectorAggregateInput,
): StoryDirectorAggregateResult {
  const conclusion = determineStoryConclusion(input.steps)
  const summary = buildAggregatedSummary(input)

  return {
    conclusion,
    summary,
  }
}

export type { StoryDirectorPlan, StoryStep }
