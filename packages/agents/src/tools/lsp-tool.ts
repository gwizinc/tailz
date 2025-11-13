import type { Sandbox } from '@daytonaio/sdk'
import { LspLanguageId } from '@daytonaio/sdk'
import { tool } from 'ai'
import { z } from 'zod'

import { resolveWorkspacePath } from '../helpers/daytona'

const lspLanguageSchema = z.enum(['typescript', 'python'])

const lspCommandSchema = z.enum(['documentSymbols', 'sandboxSymbols'])

const lspToolInputSchema = z
  .object({
    language: lspLanguageSchema
      .default('typescript')
      .describe('Programming language to use for the LSP server.'),
    command: lspCommandSchema.describe(
      'Which LSP command to run: "documentSymbols" for a single file or "sandboxSymbols" to search the codebase.',
    ),
    path: z
      .string()
      .min(1)
      .max(4_096)
      .optional()
      .describe(
        'File path for documentSymbols. Can be repo-relative or an absolute path pointing inside the repository.',
      ),
    query: z
      .string()
      .min(1)
      .max(512)
      .optional()
      .describe('Search query for sandboxSymbols.'),
  })
  .refine(
    (value) =>
      (value.command === 'documentSymbols' && value.path) ||
      (value.command === 'sandboxSymbols' && value.query),
    {
      message:
        'documentSymbols requires a path, sandboxSymbols requires a query.',
    },
  )

const languageMap: Record<z.infer<typeof lspLanguageSchema>, LspLanguageId> = {
  typescript: LspLanguageId.TYPESCRIPT,
  python: LspLanguageId.PYTHON,
}

export function createLspTool(ctx: { sandbox: Sandbox }) {
  return tool({
    name: 'lsp',
    description:
      'Use the LSP server to inspect code symbols within the workspace (documentSymbols or sandboxSymbols).',
    inputSchema: lspToolInputSchema,
    execute: async (input) => {
      console.log('🌵 LSP used', { input })
      const projectRoot = `workspace/repo`
      const lspServer = await ctx.sandbox.createLspServer(
        languageMap[input.language],
        projectRoot,
      )

      await lspServer.start()

      try {
        if (input.command === 'documentSymbols') {
          const targetPath = resolveWorkspacePath(input.path!)

          if (!targetPath) {
            return 'File path must be within the current repository workspace.'
          }

          await lspServer.didOpen(targetPath)
          const symbols = await lspServer.documentSymbols(targetPath)
          await lspServer.didClose(targetPath).catch(() => undefined)
          return JSON.stringify(symbols, null, 2)
        }

        const symbols = await lspServer.sandboxSymbols(input.query!)
        return JSON.stringify(symbols, null, 2)
      } finally {
        await lspServer.stop()
      }
    },
  })
}
