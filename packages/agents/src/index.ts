export { parseEnv } from './helpers/env'

export type AgentVersion = 'v3'

export const AGENT_CONFIG = {
  version: 'v3' as AgentVersion,
  decomposition: {
    maxSteps: 30,
    model: 'gpt-5-mini',
  },
  evaluation: {
    maxSteps: 30,
    model: 'gpt-5-mini',
  },
} as const

export {
  runStoryEvaluationAgent,
  normalizeStoryTestResult,
} from './agents/v3/story-evaluator'

export { runStoryDecompositionAgent } from './agents/v3/story-decomposition'

export type { StoryEvaluationAgentResult } from './agents/schema'

export type {
  StoryDecompositionAgentResult,
  StoryDecompositionAgentOptions,
} from './agents/v3/story-decomposition'

export {
  createShareThoughtTool,
  shareThoughtInputSchema,
} from './tools/share-thought-tool'

export { createReadFileTool, readFileInputSchema } from './tools/read-file-tool'

export { createLspTool } from './tools/lsp-tool'

export {
  createResolveLibraryTool,
  createGetLibraryDocsTool,
} from './tools/context7-tool'
