import type { Tracer } from '@opentelemetry/api'
import z from 'zod'
import type { DecompositionAgentResult } from './v3/story-decomposition'

const evidenceItemSchema = z.object({
  conclusion: z.enum(['pass', 'fail']),
  filePath: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  note: z
    .string()
    .min(1)
    .describe(
      'Markdown explanation that elaborates briefly on this discovery.',
    ),
})

export const analysisSchema = z.object({
  version: z.literal(3),
  status: z.enum(['pass', 'fail', 'skipped', 'error']),
  explanation: z.string().min(1),
  evidence: z.array(evidenceItemSchema).default([]),
})

export type EvaluationAgentResult = z.infer<typeof analysisSchema>

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
  run: {
    id: string
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

export type StoryEvaluationAgentMetrics = {
  stepCount: number
  toolCallCount: number
}
