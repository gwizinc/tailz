import z from 'zod'

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

// Agent types
export type {
  CacheEntry,
  ValidationResult,
  evaluationAgentOptions,
} from './agent-types'

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
          cachedFromRunId: z.string().optional(),
        }),
      ),
    }),
  ),
})

export type EvaluationAnalysisResult = z.infer<typeof analysisSchema>
