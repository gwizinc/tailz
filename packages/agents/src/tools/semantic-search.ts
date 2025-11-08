/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { tool } from 'ai'
import { z } from 'zod'

import { performQdrantSearch } from '../helpers/qdrant'
import type { CodeSearchHit } from '../helpers/qdrant'
import { createEmbeddings } from '../helpers/embeddings'

export const DEFAULT_RESULT_LIMIT = 8
export const MAX_RESULT_LIMIT = 24

export interface SearchContext {
  repoId: string
  branch: string
}

export interface BaseSearchOptions extends SearchContext {
  limit?: number
  extType?: string | null
}

export interface SemanticSearchOptions extends BaseSearchOptions {
  query: string
}

export const semanticSearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(8_000)
    .describe('Semantic search query for repository code'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_RESULT_LIMIT)
    .optional()
    .describe('Maximum number of files to return'),
  extType: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .describe('File extension filter (e.g. ts, tsx, py)'),
})

export function ensureBoundedLimit(limit?: number): number {
  const requested = typeof limit === 'number' ? limit : DEFAULT_RESULT_LIMIT
  return Math.min(Math.max(requested, 1), MAX_RESULT_LIMIT)
}

export async function semanticCodeSearch(
  options: SemanticSearchOptions,
): Promise<CodeSearchHit[]> {
  const trimmedQuery = options.query.trim()

  if (trimmedQuery.length === 0) {
    throw new Error('Search query is required to retrieve code context')
  }

  const limited = ensureBoundedLimit(options.limit)
  const vectors = await createEmbeddings(trimmedQuery)

  const hits = await performQdrantSearch(
    { repoId: options.repoId, branch: options.branch },
    vectors,
    limited,
  )

  if (options.extType) {
    return hits.filter((hit) => hit.path.endsWith(`.${options.extType}`))
  }

  return hits
}

export function createSemanticCodeSearchTool(context: SearchContext) {
  return tool({
    name: 'semanticCodeSearch',
    description:
      'Retrieve relevant repository files and code snippets using semantic search.',
    inputSchema: semanticSearchInputSchema,
    execute: async ({ query, limit, extType }) => {
      const hits = await semanticCodeSearch({
        ...context,
        query,
        limit,
        extType: extType ?? null,
      })

      return {
        hits,
        meta: {
          limit: ensureBoundedLimit(limit),
          extType: extType ?? null,
        },
      }
    },
  })
}
