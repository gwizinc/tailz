import type { Tracer } from '@opentelemetry/api'

/**
 * Cache entry for story evaluation evidence
 */
export type CacheEntry = {
  id: string
  branchName: string
  storyId: string
  commitSha: string
  cacheData: {
    steps: {
      [stepIndex: string]: {
        assertions: {
          [assertionIndex: string]: Record<string, string>
        }
      }
    }
  }
  runId: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Validation result for cache entries
 */
export type ValidationResult = {
  isValid: boolean
  invalidSteps: number[]
  invalidAssertions: {
    stepIndex: number
    assertionIndex: number
  }[]
}

/**
 * Options for the evaluation agent
 * Note: decomposition type is imported from @app/agents at usage sites to avoid circular dependency
 */
export type evaluationAgentOptions = {
  repo: {
    id: string
    slug: string
  }
  story: {
    id: string
    name: string
    text: string
    decomposition: unknown // DecompositionAgentResult - imported at usage sites
  }
  options?: {
    /** Maximum number of steps to take */
    maxSteps?: number
    /** Model ID to use like "gpt-5-mini" */
    modelId?: string
    /** Daytona Sandbox ID to use */
    daytonaSandboxId?: string
    telemetryTracer?: Tracer
    /** Branch name for cache lookup */
    branchName?: string
    /** Run ID for cache metadata */
    runId?: string
    /** Cache entry and validation result (set by test-story.ts) */
    cacheEntry?: CacheEntry | null
    validationResult?: ValidationResult | null
  }
}
