import path from 'node:path'

import type { Sandbox } from '@daytonaio/sdk'
import { tool } from 'ai'
import { z } from 'zod'

export const readFileInputSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(4_096)
    .describe(
      'Absolute or repo-relative path to the file within the Daytona sandbox workspace.',
    ),
})

function resolveWorkspacePath(
  inputPath: string,
  repoName: string,
): string | null {
  const workspaceRoot = `workspace/${repoName}`
  const normalized = inputPath.replace(/\\/g, '/')

  if (normalized.startsWith(workspaceRoot)) {
    return normalized
  }

  const repoSegment = `/${repoName}/`
  if (normalized.startsWith('/')) {
    const repoIndex = normalized.indexOf(repoSegment)
    if (repoIndex >= 0) {
      const relativeToRepo =
        normalized.slice(repoIndex + repoSegment.length) || '.'
      const resolved = path.posix.join(workspaceRoot, relativeToRepo)
      return resolved.startsWith(workspaceRoot) ? resolved : null
    }
    return null
  }

  const resolved = path.posix.join(workspaceRoot, normalized)
  return resolved.startsWith(workspaceRoot) ? resolved : null
}

export function createReadFileTool(ctx: {
  sandbox: Sandbox
  repoName: string
}) {
  return tool({
    name: 'readFile',
    description:
      'Download and return the entire contents of a file from the Daytona sandbox workspace.',
    inputSchema: readFileInputSchema,
    execute: async (input) => {
      const workspacePath = resolveWorkspacePath(input.path, ctx.repoName)

      if (!workspacePath) {
        const message =
          'File path must be within the current repository workspace.'
        console.error(`📄 Failed to resolve file path`, {
          repoName: ctx.repoName,
          inputPath: input.path,
        })
        return message
      }

      try {
        const downloadedFile = await ctx.sandbox.fs.downloadFile(workspacePath)
        const content = downloadedFile.toString('utf-8')
        console.log('📄 File content:', { workspacePath, content })
        return content
      } catch (error) {
        console.error(`📄 Failed to read file`, { error })
        throw error
      }
    },
  })
}
