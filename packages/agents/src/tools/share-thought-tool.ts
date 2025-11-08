import { logger } from '@trigger.dev/sdk'
import { tool } from 'ai'
import { z } from 'zod'

export const shareThoughtInputSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(4_000)
    .describe('Detailed explanation of the thought, plan, or concern.'),
})

interface ShareThoughtToolContext {
  storyName: string
  repoId: string
  runId?: string | null
}

export function createShareThoughtTool(context: ShareThoughtToolContext) {
  return tool({
    name: 'shareThought',
    description:
      'Capture intermediate reasoning, intentions, or observations during story evaluation runs.',
    inputSchema: shareThoughtInputSchema,
    execute: (input) => {
      logger.info(`💭 ${input.message}`, { context })
      return 'Thought recorded.'
    },
  })
}
