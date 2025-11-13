import type { Tracer } from '@opentelemetry/api'
import z from 'zod'
import type { DecompositionAgentResult } from './v3/story-decomposition'

export const statusSchema = z.enum([
  'pass',
  'fail',
  'running',
  // 'uncertain', // TODO add to database to enable
  // CI build was cancelled because another commit came in
  'skipped',
  // An error occurred while evaluating the story
  'error',
])

export type Status = z.infer<typeof statusSchema>

/**
 * Schema for the evaluation agent output
 */
export const analysisSchema = z.object({
  version: z.literal(3),
  status: statusSchema,
  explanation: z.string().min(1),
  steps: z.array(
    z.object({
      type: z.enum(['given', 'requirement']),
      conclusion: statusSchema,
      outcome: z.string().min(1),
      assertions: z.array(
        z.object({
          fact: z.string().min(1),
          evidence: z.array(z.string().min(1)),
        }),
      ),
    }),
  ),
})

export type EvaluationAnalysisResult = z.infer<typeof analysisSchema>

export type evaluationAgentOptions = {
  repo: {
    id: string
    slug: string
  }
  story: {
    id: string
    name: string
    text: string
    decomposition: DecompositionAgentResult
  }
  options?: {
    /** Maximum number of steps to take */
    maxSteps?: number
    /** Model ID to use like "gpt-5-mini" */
    modelId?: string
    /** Daytona Sandbox ID to use */
    daytonaSandboxId?: string
    telemetryTracer?: Tracer
  }
}
