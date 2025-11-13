import { analysisSchema } from './agents/schema'
import { decompositionOutputSchema } from './agents/v3/story-decomposition'
import { runDecompositionAgent } from './agents/v3/story-decomposition'
import { runEvaluationAgent } from './agents/v3/story-evaluator'

export const agents = {
  decomposition: {
    id: 'story-decomposition-v3',
    version: 'v3',
    schema: decompositionOutputSchema,
    run: runDecompositionAgent,
    options: {
      maxSteps: 30,
      model: 'gpt-5-mini',
    },
  },
  evaluation: {
    id: 'story-evaluation-v3',
    version: 'v3',
    schema: analysisSchema,
    run: runEvaluationAgent,
    options: {
      maxSteps: 30,
      model: 'gpt-5-mini',
    },
  },
} as const
