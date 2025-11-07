import { createHash } from 'node:crypto'

import { tool } from 'ai'
import { OpenAIEmbedding } from '@zilliz/claude-context-core'
import { QdrantClient } from '@qdrant/js-client-rest'
import { logger } from '@trigger.dev/sdk'
import { z } from 'zod'

import { buildQdrantErrorDetails } from '@/helpers/qdrant'
import { parseEnv } from '@/helpers/env'

const STORY_CONTEXT_TOOL_DEFAULT_LIMIT = 8
const STORY_CONTEXT_TOOL_MAX_LIMIT = 24

interface CodeFileResult {
  id: string
  path: string
  content: string
  commitSha: string
  branch?: string | null
  score: number
}

const searchCodeToolInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(8_000)
    .describe('Semantic search query for repository code'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(STORY_CONTEXT_TOOL_MAX_LIMIT)
    .optional()
    .describe('Maximum number of files to return'),
  extType: z
    .string()
    .min(1)
    .max(256)
    .optional()
    .describe(
      'File extension hint for filtering search results (e.g. "tsx", "ts", "js", "jsx", "py", etc.)',
    ),
})

type SearchCodeToolInput = z.infer<typeof searchCodeToolInputSchema>

function ensureStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

async function searchCode(options: {
  repoId: string
  query: string
  commitSha?: string | null
  limit?: number
  extType?: string | null
}): Promise<CodeFileResult[]> {
  const env = parseEnv()

  const collectionName = `repo_embeddings_${options.repoId}`
  const embedding = new OpenAIEmbedding({
    apiKey: env.OPENAI_API_KEY,
    model: 'text-embedding-3-small',
  })

  const qdrantClient = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
  })

  const queryVector = (await embedding.embed(options.query)).vector

  if (!Array.isArray(queryVector) || queryVector.length === 0) {
    throw new Error('Failed to generate embedding for search query')
  }

  type SearchParams = Parameters<QdrantClient['search']>[1]

  const baseSearchParams: SearchParams = {
    vector: queryVector,
    limit: options.limit ?? STORY_CONTEXT_TOOL_DEFAULT_LIMIT,
    with_payload: true,
    filter: options.commitSha
      ? {
          must: [
            {
              key: 'commitSha',
              match: { value: options.commitSha },
            },
            options.extType
              ? {
                  key: 'extType',
                  match: { value: options.extType },
                }
              : undefined,
          ].filter(Boolean),
        }
      : undefined,
  }

  try {
    const searchResult = await qdrantClient.search(
      collectionName,
      baseSearchParams,
    )

    return searchResult.map((point) => {
      const payload = toRecord(point.payload)
      return {
        id: String(
          point.id ??
            createHash('sha1').update(JSON.stringify(point)).digest('hex'),
        ),
        path: ensureStringValue(payload.path),
        content: ensureStringValue(payload.content),
        commitSha: ensureStringValue(payload.commitSha),
        branch: typeof payload.branch === 'string' ? payload.branch : null,
        score: Number(point.score ?? 0),
      }
    })
  } catch (error) {
    const errorDetails = buildQdrantErrorDetails(error, {
      repoId: options.repoId,
      commitSha: options.commitSha ?? 'unknown',
      collection: collectionName,
      fileCount: 0,
    })

    logger.error('Failed to search Qdrant for code files', errorDetails)
    throw error
  }
}

export function createSearchCodeTool(options: {
  repoId: string
  commitSha?: string | null
}) {
  return tool({
    description:
      'Retrieve relevant repository files and code snippets using semantic search in Qdrant.',
    inputSchema: searchCodeToolInputSchema,
    execute: async ({ query, limit, extType }: SearchCodeToolInput) => {
      console.log('🔍 Calling searchCodeTool', {
        options,
        query,
        limit,
        extType,
      })

      const trimmedQuery = query.trim()

      if (trimmedQuery.length === 0) {
        throw new Error('Search query is required to retrieve code context')
      }

      const requestedLimit =
        typeof limit === 'number' ? limit : STORY_CONTEXT_TOOL_DEFAULT_LIMIT
      const boundedLimit = Math.min(
        Math.max(requestedLimit, 1),
        STORY_CONTEXT_TOOL_MAX_LIMIT,
      )

      try {
        const files = await searchCode({
          repoId: options.repoId,
          query: trimmedQuery,
          commitSha: options.commitSha ?? undefined,
          limit: boundedLimit,
          extType: extType ?? undefined,
        })

        console.log('🔍 searchCodeTool returned', {
          options,
          query,
          files,
        })

        return {
          files,
          meta: {
            limit: boundedLimit,
            queryLength: trimmedQuery.length,
            extType: extType ?? null,
          },
        }
      } catch (error) {
        logger.warn('codeSearchTool tool failed', {
          repoId: options.repoId,
          commitSha: options.commitSha ?? null,
          limit: boundedLimit,
          error,
        })
        throw new Error('Unable to retrieve additional context from Qdrant')
      }
    },
  })
}

export type SearchCodeTool = ReturnType<typeof createSearchCodeTool>
