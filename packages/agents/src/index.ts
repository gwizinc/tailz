import { analysisSchema } from '@app/schemas'
import { decompositionOutputSchema } from './agents/v3/story-decomposition'
import { runDecompositionAgent } from './agents/v3/story-decomposition'
import { main } from './agents/v3/story-evaluator'
import { parseEnv } from '@app/config'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export { type Status } from '@app/schemas'
export { generateText } from './helpers/generate-text'

const env = parseEnv()

function model(
  gateway: 'openai' | 'openrouter' | 'ai-gateway',
  modelId: string,
): any {
  if (gateway === 'openai') {
    return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId)
  }
  if (gateway === 'openrouter') {
    return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(modelId)
  }
  if (gateway === 'ai-gateway') {
    return modelId
  }
  throw new Error(`Unsupported provider: ${gateway}`)
}

export const agents = {
  decomposition: {
    id: 'story-decomposition-v3',
    version: 'v3',
    schema: decompositionOutputSchema,
    run: runDecompositionAgent,
    options: {
      maxSteps: 15, // typically ends in 3-5 steps
      model: model('openai', 'gpt-5-mini'),
    },
  },
  evaluation: {
    id: 'story-evaluation-v3',
    version: 'v3',
    schema: analysisSchema,
    run: main,
    options: {
      maxSteps: 50,
      model: model('openrouter', 'openai/gpt-5.1-codex-mini'),
    },
  },
} as const
