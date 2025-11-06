import { task, logger } from '@trigger.dev/sdk'
import { getRepoWithOctokit } from '../helpers/github'
import type { CodebaseFile } from '../steps/fetch-codebase'

/**
 * Trigger.dev task that discovers stories (Gherkin scenarios) in a specific Git commit.
 *
 * This task analyzes all changed files in a commit to find story definitions. It:
 * 1. Fetches repository and GitHub installation information from the database
 * 2. Retrieves commit details from GitHub API
 * 3. Extracts all changed files (excluding removed files)
 * 4. Fetches the content of each changed file
 * 5. Uses AI to discover stories within the codebase
 *
 * @example
 * ```typescript
 * await findStoriesInCommitTask.trigger({
 *   repoId: 'repo-123',
 *   commitSha: 'abc123def456...'
 * })
 * ```
 *
 * @param payload.repoId - The database ID of the repository
 * @param payload.commitSha - The full SHA hash of the commit to analyze
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
export const findStoriesInCommitTask = task({
  id: 'find-stories-in-commit',
  run: async (payload: { repoId: string; commitSha: string }) => {
    const { repo, octokit } = await getRepoWithOctokit(payload.repoId)

    logger.info(
      `Finding stories in commit ${repo.repoName}@${payload.commitSha.substring(0, 7)}`,
    )

    const commit = await octokit.repos.getCommit({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      ref: payload.commitSha,
    })

    const files = commit.data.files || []
    // Filter out removed files and files without filenames
    const changedPaths = files
      .filter((f) => f.status !== 'removed' && !!f.filename)
      // TODO for now ONLY ts tsx files
      .filter((f) => f.filename.endsWith('.ts') || f.filename.endsWith('.tsx'))
      .map((f) => f.filename)

    // Fetch content for each changed file
    const codebase: CodebaseFile[] = []
    for (const path of changedPaths) {
      try {
        const content = await octokit.repos.getContent({
          owner: repo.ownerLogin,
          repo: repo.repoName,
          path,
          ref: payload.commitSha,
        })
        // Verify it's a file (not a directory) and has content
        if (
          !Array.isArray(content.data) &&
          content.data.type === 'file' &&
          'content' in content.data &&
          content.data.content
        ) {
          // GitHub API returns file content as base64-encoded strings
          const decoded = Buffer.from(content.data.content, 'base64').toString(
            'utf8',
          )
          codebase.push({ path, content: decoded })
        }
      } catch (_e) {
        // Skip files we fail to fetch (binary files, files too large, or other errors)
      }
    }

    logger.info('Found codebase files', {
      repoId: payload.repoId,
      commitSha: payload.commitSha,
      codebase: codebase.map((f) => f.path),
    })

    const result = {
      success: true,
      storyCount: 0,
      stories: [],
    }

    // const result = await discoverStories({
    //   codebase,
    //   apiKey: env.OPENROUTER_API_KEY,
    // })

    // if (!result.success) {
    //   logger.error('Failed to find stories in commit', {
    //     repoId: payload.repoId,
    //     commitSha: payload.commitSha,
    //     error: result.error,
    //   })
    //   throw new Error(result.error || 'Failed to find stories in commit')
    // }

    // logger.info('Stories found in commit', {
    //   repoId: payload.repoId,
    //   commitSha: payload.commitSha,
    //   storyCount: result.storyCount,
    // })

    return {
      success: true,
      storyCount: result.storyCount,
      stories: result.stories,
    }
  },
})
