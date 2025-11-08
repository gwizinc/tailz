import { createHash } from 'node:crypto'
import { logger } from '@trigger.dev/sdk'
import type { CodebaseFile } from '../steps/fetch-codebase'
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { buildQdrantErrorDetails, getQdrantClient } from '@app/agents'
import { createEmbeddings } from '@app/agents'

function generateDeterministicUUID(input: string): string {
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
  const hash = createHash('sha1')
    .update(namespace + input)
    .digest()

  const hashBuffer = Buffer.from(hash)
  hashBuffer[6] = (hashBuffer[6] & 0x0f) | 0x50
  hashBuffer[8] = (hashBuffer[8] & 0x3f) | 0x80

  const hex = hashBuffer.toString('hex')
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-')
}

function extractExtType(path: string): string | null {
  const segments = path.split('/')
  const fileName = segments[segments.length - 1] ?? ''

  if (!fileName.includes('.')) {
    return null
  }

  const extension = fileName.split('.').pop()
  return extension ? extension.toLowerCase() : null
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

    const collectionName = `test`
    const qdrantClient = getQdrantClient()

    logger.info(
      `Indexing ${files.length} files to Qdrant collection: ${collectionName}`,
    )

    for (const file of files) {
      try {
        const fileIdString = `${repoId}:${file.path}:${commitSha}`
        const fileId = generateDeterministicUUID(fileIdString)
        const extType = extractExtType(file.path)

        const MAX_PAYLOAD_SIZE = 50_000
        const contentPreview =
          file.content.length > MAX_PAYLOAD_SIZE
            ? file.content.substring(0, MAX_PAYLOAD_SIZE) + '... [truncated]'
            : file.content

        const { dense, sparse } = await createEmbeddings(file.content)

        const point = {
          id: fileId,
          vector: { dense, sparse },
          payload: {
            path: file.path,
            repo_id: repoId,
            commitSha,
            branch,
            extType,
            content: contentPreview,
            contentLength: file.content.length,
          },
        }

        await qdrantClient.upsert(collectionName, {
          points: [point],
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
