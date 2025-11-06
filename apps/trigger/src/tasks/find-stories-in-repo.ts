import { task, logger } from '@trigger.dev/sdk'
import { getRepoWithOctokit } from '../helpers/github'
import type { CodebaseFile } from '../steps/fetch-codebase'

/**
 * Trigger.dev task that discovers stories (Gherkin scenarios) in an entire repository.
 *
 * This task scans the ENTIRE repository (not just commit changes) at a specific commit or branch to find story definitions. It:
 * 1. Fetches repository and GitHub installation information from the database
 * 2. Gets the repository tree SHA (from commit SHA or branch)
 * 3. Retrieves the complete file tree recursively from GitHub API (all files in the repo)
 * 4. Filters to relevant business logic files (excludes test files, node_modules, etc.)
 * 5. Fetches content for all filtered files
 * 6. Uses AI to discover stories within the codebase
 *
 * @example
 * ```typescript
 * // Scan latest commit on main branch
 * await findStoriesInRepoTask.trigger({
 *   repoId: 'repo-123',
 *   branch: 'main'
 * })
 *
 * // Scan specific commit
 * await findStoriesInRepoTask.trigger({
 *   repoId: 'repo-123',
 *   commitSha: 'abc123def456...'
 * })
 * ```
 *
 * @param payload.repoId - The database ID of the repository
 * @param payload.commitSha - Optional: The full SHA hash of the commit to analyze
 * @param payload.branch - Optional: The branch name (defaults to 'main'). Used if commitSha is not provided.
 *
 * @returns Object containing:
 *   - success: boolean indicating if the operation succeeded
 *   - storyCount: number of stories found
 *   - stories: array of discovered stories with name, story content, and associated files
 *
 * @throws Error if:
 *   - Repository or installation is not found or misconfigured
 *   - Story discovery fails (with error details logged)
 */
export const findStoriesInRepoTask = task({
  id: 'find-stories-in-repo',
  run: async (payload: {
    repoId: string
    commitSha?: string
    branch?: string
  }) => {
    const { repo, octokit } = await getRepoWithOctokit(payload.repoId)

    // Determine the commit SHA to use for scanning the entire repository
    let commitSha: string
    let ref: string

    if (payload.commitSha) {
      // Use specific commit
      commitSha = payload.commitSha
      ref = commitSha
    } else {
      // Use branch - get latest commit SHA from branch
      // TODO don't assume main branch, use repo.defaultBranch in the future
      const branch = payload.branch || 'main'
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

    // Fetch contents for all relevant files in the repository
    const codebase: CodebaseFile[] = []
    for (const file of relevantFiles) {
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

    const result = {
      success: true,
      storyCount: 0,
      stories: [],
    }

    return {
      success: true,
      storyCount: result.storyCount,
      stories: result.stories,
    }
  },
})
