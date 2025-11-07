import { createHash } from 'node:crypto'

import { QdrantClient } from '@qdrant/js-client-rest'
import { task, logger } from '@trigger.dev/sdk'

import { indexFilesToQdrant } from '../helpers/index-codebase'
import { parseEnv } from '../helpers/env'
import { getRepoWithOctokit } from '../helpers/github'
import { buildQdrantErrorDetails } from '../helpers/qdrant'
import type { CodebaseFile } from '../steps/fetch-codebase'

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

/**
 * Trigger.dev task that indexes an entire repository into Qdrant for semantic search.
 *
 * This task scans the ENTIRE repository (not just commit changes) at a specific commit or branch to gather source files. It:
 * 1. Fetches repository and GitHub installation information from the database
 * 2. Gets the repository tree SHA (from commit SHA or branch)
 * 3. Retrieves the complete file tree recursively from GitHub API (all files in the repo)
 * 4. Filters to relevant business logic files (excludes test files, node_modules, etc.)
 * 5. Fetches content for all filtered files
 * 6. Indexes all codebase files to Qdrant vector database for semantic search
 *
 * @example
 * ```typescript
 * // Scan latest commit on main branch
 * await indexRepoTask.trigger({
 *   repoId: 'repo-123',
 *   branch: 'main'
 * })
 *
 * // Scan specific commit
 * await indexRepoTask.trigger({
 *   repoId: 'repo-123',
 *   commitSha: 'abc123def456...'
 * })
 *
 * // Limit files for testing
 * await indexRepoTask.trigger({
 *   repoId: 'repo-123',
 *   branch: 'main',
 *   options: { limit: 10 }
 * })
 * ```
 *
 * @param payload.repoId - The database ID of the repository
 * @param payload.commitSha - Optional: The full SHA hash of the commit to analyze
 * @param payload.branch - Optional: The branch name (defaults to 'main'). Used if commitSha is not provided.
 * @param payload.options - Optional: Configuration options
 * @param payload.options.limit - Optional: Limit the number of files to retrieve (primarily for testing purposes)
 *
 * @returns Object containing:
 *   - success: boolean indicating if the operation succeeded
 *   - files: number of files indexed
 *   - indexingResult: details returned from Qdrant indexing
 *
 * @throws Error if:
 *   - Repository or installation is not found or misconfigured
 *   - Indexing fails (with error details logged)
 */
export const indexRepoTask = task({
  id: 'index-repo',
  run: async (payload: {
    repoId: string
    commitSha?: string
    branch?: string
    options?: {
      limit?: number
    }
  }) => {
    const { repo, octokit } = await getRepoWithOctokit(payload.repoId)

    // TODO don't assume main branch, use repo.defaultBranch in the future
    const branch = payload.branch || 'main'

    // Determine the commit SHA to use for scanning the entire repository
    let commitSha: string
    let ref: string

    if (payload.commitSha) {
      // Use specific commit
      commitSha = payload.commitSha
      ref = commitSha
    } else {
      // Use branch - get latest commit SHA from branch
      ref = branch
      logger.info(
        `Getting latest commit from branch ${repo.repoName}@${branch}`,
      )
      const branchData = await octokit.repos.getBranch({
        owner: repo.ownerLogin,
        repo: repo.repoName,
        branch,
      })
      commitSha = branchData.data.commit.sha
    }

    // Get commit to retrieve tree SHA (needed to scan entire repository)
    logger.info(
      `Getting repository tree from ${repo.repoName}@${ref.substring(0, 7)}`,
    )
    const commitResponse = await octokit.repos.getCommit({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      ref: commitSha,
    })
    const treeSha = commitResponse.data.commit.tree.sha

    logger.info(
      `Scanning entire repository ${repo.repoName}@${ref} (tree: ${treeSha.substring(0, 7)})`,
    )

    // Get full repository tree (all files, not just changes)
    const { data: treeData } = await octokit.rest.git.getTree({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      tree_sha: treeSha,
      recursive: '1',
    })

    // Extract all files from the repository tree
    const allFiles = (treeData.tree ?? [])
      .filter((i) => i.type === 'blob')
      .map((i) => ({
        path: i.path ?? '',
        sha: i.sha ?? '',
        size: i.size ?? 0,
      }))

    logger.info(`Found ${allFiles.length} total files in repository`)

    // Filter to relevant business-logic files
    const ALLOWED_EXT = [
      '.ts',
      '.tsx',
      // TODO more soon ...
    ]
    const EXCLUDED_DIRS = [
      'node_modules',
      'dist',
      'build',
      'out',
      'vendor',
      'test',
      'spec',
      'docs',
      '.github',
    ]
    const MAX_FILE_SIZE = 100_000 // 100 KB

    const relevantFiles = allFiles
      .filter((f) => f.size <= MAX_FILE_SIZE)
      .filter((f) => {
        const lower = f.path.toLowerCase()
        return !EXCLUDED_DIRS.some((d) => lower.includes(`/${d}/`))
      })
      .filter((f) => {
        const lower = f.path.toLowerCase()
        return ALLOWED_EXT.some((ext) => lower.endsWith(ext))
      })

    logger.info(`Filtered to ${relevantFiles.length} relevant source files`, {
      relevantFiles,
    })

    // Apply limit if specified (primarily for testing)
    const filesToProcess = payload.options?.limit
      ? relevantFiles.slice(0, payload.options.limit)
      : relevantFiles

    if (payload.options?.limit) {
      logger.info(
        `Limiting file processing to ${payload.options.limit} files (for testing)`,
      )
    }

    const env = parseEnv()
    const collectionName = `repo_embeddings_${payload.repoId}`
    const qdrantClient = new QdrantClient({
      url: env.QDRANT_URL,
      apiKey: env.QDRANT_API_KEY,
    })

    let qdrantCollectionExists = false
    try {
      await qdrantClient.getCollection(collectionName)
      qdrantCollectionExists = true
    } catch (error) {
      const details = buildQdrantErrorDetails(error, {
        repoId: payload.repoId,
        commitSha,
        branch,
        collection: collectionName,
      })
      logger.info('Qdrant collection unavailable for pre-index check', details)
    }

    // Fetch contents for all relevant files in the repository
    const codebase: CodebaseFile[] = []
    for (const file of filesToProcess) {
      if (qdrantCollectionExists) {
        const fileIdString = `${payload.repoId}:${file.path}:${commitSha}`
        const pointId = generateDeterministicUUID(fileIdString)
        try {
          const existingPoints = await qdrantClient.retrieve(collectionName, {
            ids: [pointId],
            with_payload: false,
          })
          const hasExistingPoint = existingPoints.some((point) => {
            const pointIdentifier =
              typeof point.id === 'string' || typeof point.id === 'number'
                ? String(point.id)
                : null
            return pointIdentifier === pointId
          })

          if (hasExistingPoint) {
            logger.info(
              `Skipping ${file.path} - already indexed for commit ${commitSha.substring(0, 7)}`,
            )
            continue
          }
        } catch (error) {
          const details = buildQdrantErrorDetails(error, {
            repoId: payload.repoId,
            commitSha,
            branch,
            collection: collectionName,
            file: file.path,
            fileId: pointId,
          })
          logger.warn('Failed to verify existing Qdrant point', details)
        }
      }

      try {
        const { data } = await octokit.rest.git.getBlob({
          owner: repo.ownerLogin,
          repo: repo.repoName,
          file_sha: file.sha,
        })
        const decoded = Buffer.from(
          (data as { content: string }).content,
          'base64',
        ).toString('utf8')
        codebase.push({ path: file.path, content: decoded })
      } catch (err) {
        logger.warn(
          `Skipped ${file.path}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
      }
    }

    logger.info('Found codebase files', {
      repoId: payload.repoId,
      commitSha,
      codebase: codebase.map((f) => f.path),
    })

    logger.info('Indexing codebase files to Qdrant', {
      repoId: payload.repoId,
      commitSha,
      branch,
      fileCount: codebase.length,
    })

    const indexingResult = await indexFilesToQdrant(
      codebase,
      payload.repoId,
      commitSha,
      branch,
    )

    if (!indexingResult.success) {
      logger.warn(
        `Failed to index files to Qdrant: ${indexingResult.error ?? 'Unknown error'}`,
      )
    } else {
      logger.info('Successfully indexed codebase files to Qdrant')
    }

    return {
      indexingResult,
      files: filesToProcess.length,
    }
  },
})
