import type { Sandbox } from '@daytonaio/sdk'
import { tool } from 'ai'
import { z } from 'zod'

const terminalCommandInputSchema = z.object({
  description: z
    .string()
    .min(1)
    .max(256)
    .describe(
      'A short, human-readable description of the command intent. Like "find function called xyz"',
    ),
  command: z
    .string()
    .min(1)
    .max(8_000)
    .describe(
      'The non-interactive shell command to run inside the VM sandbox.',
    ),
})

export function createTerminalCommandTool(ctx: {
  sandbox: Sandbox
  repoName: string
}) {
  return tool({
    name: 'terminalCommand',
    description:
      'Execute read-only, non-interactive shell commands (e.g. rg, fd, tree, sed, grep, git, find, etc.) within the repository workspace.',
    inputSchema: terminalCommandInputSchema,
    execute: async (input) => {
      const result = await ctx.sandbox.process.executeCommand(
        input.command,
        `workspace/${ctx.repoName}`,
      )

      const output = result.result ?? ''

      if (result.exitCode !== 0) {
        return JSON.stringify({
          exitCode: result.exitCode,
          output,
        })
      }

      return output
    },
  })
}
