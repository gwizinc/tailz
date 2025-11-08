import { createHash } from 'node:crypto'

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { QdrantClient } from '@qdrant/js-client-rest'

import { parseEnv } from './env'
import type { Vectors } from './embeddings'

export interface LoggerLike {
  error: (message: string, details?: Record<string, unknown>) => void
}

const defaultLogger: LoggerLike = {
  error: (message, details) => {
    if (details) {
      console.error(message, details)
    } else {
      console.error(message)
    }
  },
}

let activeLogger: LoggerLike = defaultLogger

export function setAgentLogger(logger: LoggerLike | null | undefined): void {
  activeLogger = logger ?? defaultLogger
}

export function getQdrantClient(): QdrantClient {
  const env = parseEnv()

  return new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
  })
}

interface QdrantSearchContext {
  repoId: string
  branch: string
}

export interface CodeSearchHit {
  id: string
  path: string
  content: string
  commitSha: string
  branch: string | null
  score: number
}

function ensureStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export async function performQdrantSearch(
  context: QdrantSearchContext,
  vectors: Vectors,
  limit: number,
): Promise<CodeSearchHit[]> {
  const collectionName = `test`
  const qdrantClient = getQdrantClient()

  try {
    const searchResult = await qdrantClient.searchBatch(collectionName, {
      searches: [
        {
          vector: {
            name: 'dense',
            vector: vectors.dense,
          },
          limit,
          with_payload: true,
        },
        {
          vector: {
            name: 'sparse',
            vector: vectors.sparse,
          },
          limit,
          with_payload: true,
        },
      ],
    })

    return searchResult.flat(1).map((point) => {
      const payload = toRecord(point.payload)
      return {
        id: String(
          point.id ??
            createHash('sha1').update(JSON.stringify(point)).digest('hex'),
        ),
        path: ensureStringValue(payload.path),
        content: ensureStringValue(payload.content),
        commitSha: ensureStringValue(payload.commitSha),
        branch:
          typeof payload.branch === 'string' && payload.branch.length > 0
            ? payload.branch
            : null,
        score: Number(point.score ?? 0),
      }
    })
  } catch (error) {
    const errorDetails = buildQdrantErrorDetails(error, {
      repoId: context.repoId,
      commitSha: 'unknown',
      branch: context.branch,
      collection: collectionName,
      fileCount: 0,
    })

    activeLogger.error('Failed to search Qdrant for code files', errorDetails)
    throw error
  }
}

interface QdrantErrorContext {
  repoId: string
  commitSha: string
  branch?: string
  collection?: string
  file?: string
  fileSize?: number
  fileId?: string
  fileCount?: number
}

function extractQdrantErrorMessage(errorData: unknown): string | null {
  if (!errorData || typeof errorData !== 'object') {
    return null
  }

  const data = errorData as Record<string, unknown>

  if (typeof data.status === 'object' && data.status !== null) {
    const status = data.status as Record<string, unknown>
    if (typeof status.error === 'string') {
      return status.error
    }
    if (typeof status.message === 'string') {
      return status.message
    }
  }

  if (typeof data.error === 'string') {
    return data.error
  }

  if (typeof data.message === 'string') {
    return data.message
  }

  if (typeof data.detail === 'string') {
    return data.detail
  }

  if (Array.isArray(data.errors)) {
    const errors = data.errors
      .map((e) => {
        if (typeof e === 'string') {
          return e
        }
        if (e && typeof e === 'object') {
          const err = e as Record<string, unknown>
          return (
            (typeof err.message === 'string' ? err.message : null) ||
            (typeof err.error === 'string' ? err.error : null) ||
            JSON.stringify(e)
          )
        }
        return String(e)
      })
      .filter(Boolean)
    if (errors.length > 0) {
      return errors.join('; ')
    }
  }

  return null
}

export function buildQdrantErrorDetails(
  error: unknown,
  context: QdrantErrorContext,
): Record<string, unknown> {
  const errorDetails: Record<string, unknown> = {
    repoId: context.repoId,
    commitSha: context.commitSha,
    branch: context.branch ?? null,
  }

  if (context.collection) {
    errorDetails.collection = context.collection
  }

  if (context.file) {
    errorDetails.file = context.file
  }

  if (context.fileSize !== undefined) {
    errorDetails.fileSize = context.fileSize
  }

  if (context.fileId) {
    errorDetails.fileId = context.fileId
  }

  if (context.fileCount !== undefined) {
    errorDetails.fileCount = context.fileCount
  }

  if (error instanceof Error) {
    errorDetails.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  } else {
    errorDetails.error = { type: typeof error, value: String(error) }
  }

  const qdrantError = error as {
    response?: {
      status?: number
      statusText?: string
      data?: unknown
      _data?: unknown
    }
    body?: unknown
    data?: unknown
    message?: string
  }

  if (qdrantError.response) {
    const response = qdrantError.response
    errorDetails.qdrantResponse = {
      status: response.status,
      statusText: response.statusText,
      data: response.data ?? response._data,
    }

    const errorMessage = extractQdrantErrorMessage(
      response.data ?? response._data,
    )
    if (errorMessage) {
      errorDetails.qdrantErrorMessage = errorMessage
    }
  }

  if (qdrantError.body) {
    errorDetails.qdrantBody = qdrantError.body
    const errorMessage = extractQdrantErrorMessage(qdrantError.body)
    if (errorMessage) {
      errorDetails.qdrantErrorMessage = errorMessage
    }
  }

  if (qdrantError.data) {
    errorDetails.qdrantData = qdrantError.data
    const errorMessage = extractQdrantErrorMessage(qdrantError.data)
    if (errorMessage) {
      errorDetails.qdrantErrorMessage = errorMessage
    }
  }

  return errorDetails
}
