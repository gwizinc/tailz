import type { FinishReason } from 'ai'
import z from 'zod'

const evidenceItemSchema = z.object({
  step: z
    .string()
    .min(3)
    .describe(
      'Describe the goal that is being evaluated. Short and human-readable.',
    ),
  storyText: z
    .string()
    .min(1)
    .describe(
      'The verbatim snippet of the story text this step is evaluating.',
    ),
  conclusion: z.enum(['pass', 'fail']),
  filePath: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  note: z
    .string()
    .min(1)
    .describe(
      'An explanation in markdown that elaborates briefly on this evidence.',
    ),
})

const storyAnalysisSchema = z.object({
  version: z.literal(1),
  conclusion: z.enum(['pass', 'fail', 'error']),
  explanation: z.string().min(1),
  evidence: z.array(evidenceItemSchema).default([]),
})

export const storyTestResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'running', 'error']).default('running'),
  analysis: storyAnalysisSchema.nullable().default(null),
})

export type StoryTestModelOutput = z.infer<typeof storyTestResultSchema>

export type StoryEvaluationAgentOptions = {
  storyName: string
  storyText: string
  repoId: string
  repoName: string
  runId?: string | null
  maxSteps?: number
  modelId?: string
  daytonaSandboxId: string
}

export type StoryEvaluationAgentMetrics = {
  stepCount: number
  toolCallCount: number
}

export type StoryEvaluationAgentResult = {
  output: StoryTestModelOutput
  metrics: StoryEvaluationAgentMetrics
  finishReason: FinishReason
}
