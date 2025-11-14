import { analysisSchema } from './agents/schema'
import { decompositionOutputSchema } from './agents/v3/story-decomposition'
import { runDecompositionAgent } from './agents/v3/story-decomposition'
import { main } from './agents/v3/story-evaluator'

export { type Status } from './agents/schema'
export { generateText } from './helpers/generate-text'

export const agents = {
  decomposition: {
    id: 'story-decomposition-v3',
    version: 'v3',
    schema: decompositionOutputSchema,
    run: runDecompositionAgent,
    options: {
      maxSteps: 15, // typically ends in 3-5 steps
      model: 'gpt-5-mini',
    },
  },
  evaluation: {
    id: 'story-evaluation-v3',
    version: 'v3',
    schema: analysisSchema,
    run: main,
    options: {
      maxSteps: 50,
      model: 'gpt-5-mini',
    },
  },
} as const
