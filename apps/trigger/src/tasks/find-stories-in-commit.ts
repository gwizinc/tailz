import { task, logger } from '@trigger.dev/sdk'
import { setupDb } from '@app/db'
import { createInstallationOctokit } from '../helpers/github'
import type { CodebaseFile } from '../helpers/fetch-codebase'
import { discoverStories } from '../helpers/discover-stories'

export const findStoriesInCommitTask = task({
  id: 'find-stories-in-commit',
  run: async (
    payload: {
      repoId: string
      appId: number
      privateKey: string
      openRouterApiKey: string
      databaseUrl: string
      commitSha: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Finding stories in commit', {
      repoId: payload.repoId,
      commitSha: payload.commitSha,
    })

    const db = setupDb(payload.databaseUrl)

    const repo = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.name as repoName',
        'owners.login as ownerLogin',
        'owners.installationId',
      ])
      .where('repos.id', '=', payload.repoId)
      .executeTakeFirst()

    if (!repo || !repo.installationId) {
      throw new Error('Repository or installation not found or misconfigured')
    }

    const octokit = createInstallationOctokit({
      appId: payload.appId,
      privateKey: payload.privateKey,
      installationId: Number(repo.installationId),
    })

    const commit = await octokit.repos.getCommit({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      ref: payload.commitSha,
    })

    const files = commit.data.files || []
    const changedPaths = files
      .filter((f) => f.status !== 'removed' && !!f.filename)
      .map((f) => f.filename)

    const codebase: CodebaseFile[] = []
    for (const path of changedPaths) {
      try {
        const content = await octokit.repos.getContent({
          owner: repo.ownerLogin,
          repo: repo.repoName,
          path,
          ref: payload.commitSha,
        })
        if (
          !Array.isArray(content.data) &&
          content.data.type === 'file' &&
          'content' in content.data &&
          content.data.content
        ) {
          const decoded = Buffer.from(content.data.content, 'base64').toString(
            'utf8',
          )
          codebase.push({ path, content: decoded })
        }
      } catch (e) {
        // skip files we fail to fetch (binary or too large)
      }
    }

    const result = await discoverStories({
      codebase,
      apiKey: payload.openRouterApiKey,
    })

    if (!result.success) {
      logger.error('Failed to find stories in commit', {
        repoId: payload.repoId,
        commitSha: payload.commitSha,
        error: result.error,
      })
      throw new Error(result.error || 'Failed to find stories in commit')
    }

    logger.info('Stories found in commit', {
      repoId: payload.repoId,
      commitSha: payload.commitSha,
      storyCount: result.storyCount,
    })

    return {
      success: true,
      storyCount: result.storyCount,
      stories: result.stories,
    }
  },
})
