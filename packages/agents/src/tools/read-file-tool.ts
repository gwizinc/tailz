import type { Sandbox } from '@daytonaio/sdk'
import { tool } from 'ai'
import { z } from 'zod'

import { resolveWorkspacePath } from '../helpers/daytona'

const readFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      'Absolute or repo-relative path to the file within the repository workspace.',
    ),
})

export function createReadFileTool(ctx: { sandbox: Sandbox }) {
  return tool({
    name: 'readFile',
    description:
      'Download and return the entire contents of a file from the Daytona sandbox workspace.',
    inputSchema: readFileInputSchema,
    execute: async (input) => {
      const workspacePath = resolveWorkspacePath(input.path)

      if (!workspacePath) {
        const message =
          'File path must be within the current repository workspace.'
        console.error(`📄 Failed to resolve file path`, {
          inputPath: input.path,
        })
        return message
      }

      try {
        const downloadedFile = await ctx.sandbox.fs.downloadFile(workspacePath)
        const content = downloadedFile.toString('utf-8')
        return content
      } catch (error) {
        console.error(`📄 Failed to read file`, { error })
        throw error
      }
    },
  })
}
