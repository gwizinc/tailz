/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { z } from 'zod'

// Shared enums for agent coordination
const evaluationResultSchema = z.enum([
  'pass',
  'fail',
  'not-implemented',
  'blocked',
])

const toolTraceSchema = z.object({
  summary: z.string().min(1),
  reasoning: z.array(z.string().min(1)).default([]),
  searchQueries: z.array(z.string().min(1)).default([]),
})

const reviewerCodeSnippetSchema = z.object({
  path: z.string().min(1),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  content: z.string().min(1),
})

export const stepReviewerOutputSchema = z.object({
  result: evaluationResultSchema,
  description: z.string().min(1),
  code: z.array(reviewerCodeSnippetSchema).default([]),
  trace: toolTraceSchema,
})

export type StepReviewerOutput = z.infer<typeof stepReviewerOutputSchema>

const storyStepSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  description: z.string().min(1),
})

export type StoryStep = z.infer<typeof storyStepSchema>

export const storyDirectorPlanSchema = z.object({
  story: z.string().min(1),
  steps: z.array(storyStepSchema).min(1),
  trace: toolTraceSchema,
})

export type StoryDirectorPlan = z.infer<typeof storyDirectorPlanSchema>

export const reviewerInputSchema = z.object({
  step: storyStepSchema,
  priorSteps: z.array(stepReviewerOutputSchema).default([]),
})

export type ReviewerInput = z.infer<typeof reviewerInputSchema>
