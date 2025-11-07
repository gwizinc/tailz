import { createHash } from 'node:crypto'
import { OpenAIEmbedding } from '@zilliz/claude-context-core'
import { logger } from '@trigger.dev/sdk'
import { QdrantClient } from '@qdrant/js-client-rest'
import type { CodebaseFile } from '../steps/fetch-codebase'
import { parseEnv } from './env'
import { buildQdrantErrorDetails } from './qdrant'

async function ensurePayloadIndex(
  client: QdrantClient,
  collectionName: string,
  fieldName: string,
) {
  try {
    await client.createPayloadIndex(collectionName, {
      field_name: fieldName,
      field_schema: 'keyword',
      wait: true,
    })
    logger.info('Created Qdrant payload index', {
      collectionName,
      fieldName,
    })
  } catch (error) {
    const details = buildQdrantErrorDetails(error, {
      repoId: collectionName,
      commitSha: 'N/A',
      collection: collectionName,
    })
    const message =
      typeof details.qdrantErrorMessage === 'string'
        ? details.qdrantErrorMessage
        : error instanceof Error
          ? error.message
          : null

    if (message && message.toLowerCase().includes('already exists')) {
      logger.info('Payload index already exists, skipping creation', {
        collectionName,
        fieldName,
      })
      return
    }

    logger.error('Failed to ensure payload index', {
      collectionName,
      fieldName,
      error: details,
    })
    throw error
  }
}

function generateDeterministicUUID(input: string): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const hash = createHash('sha1')
    .update(namespace + input)
    .digest()

  const hashBuffer = Buffer.from(hash)
  hashBuffer[6] = (hashBuffer[6] & 0x0F) | 0x50
  hashBuffer[8] = (hashBuffer[8] & 0x3F) | 0x80

  const hex = hashBuffer.toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-')
}

export async function indexFilesToQdrant(
  files: CodebaseFile[],
  repoId: string,
  commitSha: string,
  branch?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (files.length === 0) {
      logger.info('No files to index, skipping Qdrant indexing')
      return { success: true }
    }

    const env = parseEnv()

    const embedding = new OpenAIEmbedding({
      apiKey: env.OPENAI_API_KEY,
      model: 'text-embedding-3-small',
    })

    const collectionName = `repo_embeddings_${repoId}`
    const qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    })

    try {
      await qdrantClient.getCollection(collectionName)
    } catch {
      await qdrantClient.createCollection(collectionName, {
        vectors: { size: 1536, distance: 'Cosine' },
      })
    }

    await ensurePayloadIndex(qdrantClient, collectionName, 'commitSha')

    logger.info(
      `Indexing ${files.length} files to Qdrant collection: ${collectionName}`,
    )

    for (const file of files) {
      try {
        const embeddingVector = (await embedding.embed(file.content)).vector

        if (!Array.isArray(embeddingVector) || embeddingVector.length === 0) {
          throw new Error(
            `Invalid embedding result: expected array of numbers, got ${typeof embeddingVector}`,
          )
        }

        if (embeddingVector.length !== 1536) {
          throw new Error(
            `Invalid embedding dimension: expected 1536, got ${embeddingVector.length}`,
          )
        }

        const fileIdString = `${repoId}:${file.path}:${commitSha}`
        const fileId = generateDeterministicUUID(fileIdString)

        const MAX_PAYLOAD_SIZE = 50_000
        const contentPreview =
          file.content.length > MAX_PAYLOAD_SIZE
            ? file.content.substring(0, MAX_PAYLOAD_SIZE) + '... [truncated]'
            : file.content

        await qdrantClient.upsert(collectionName, {
          points: [
            {
              id: fileId,
              vector: embeddingVector,
              payload: {
                path: file.path,
                repoId,
                commitSha,
                branch: branch ?? null,
                content: contentPreview,
                contentLength: file.content.length,
              },
            },
          ],
        })
        logger.info(`Indexed ${file.path} (${file.content.length} bytes)`)
      } catch (err) {
        const fileIdString = `${repoId}:${file.path}:${commitSha}`
        const fileId = generateDeterministicUUID(fileIdString)

        const errorDetails = buildQdrantErrorDetails(err, {
          repoId,
          commitSha,
          branch,
          collection: collectionName,
          file: file.path,
          fileSize: file.content.length,
          fileId,
        })

        logger.error(
          `Failed to index file to Qdrant ${collectionName}: ${errorDetails.file}`,
          errorDetails,
        )
        throw err
      }
    }

    logger.info(`Successfully indexed ${files.length} files to Qdrant`)
    return { success: true }
  } catch (error) {
    const errorDetails = buildQdrantErrorDetails(error, {
      repoId,
      commitSha,
      branch,
      fileCount: files.length,
    })
    logger.error(`Failed to index files to Qdrant`, errorDetails)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    return { success: false, error: errorMessage }
  }
}
