import { task, logger } from '@trigger.dev/sdk'
import { setupDb } from '@app/db'
import { createInstallationOctokit } from '../helpers/github'
import type { CodebaseFile } from '../helpers/fetch-codebase'
import { discoverStories } from '../helpers/discover-stories'

export const findStoriesInPullRequestTask = task({
  id: 'find-stories-in-pull-request',
  run: async (
    payload: {
      repoId: string
      appId: number
      privateKey: string
      openRouterApiKey: string
      databaseUrl: string
      pullNumber: number
      refSha?: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Finding stories in pull request', {
      repoId: payload.repoId,
      pullNumber: payload.pullNumber,
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

    const prFiles = await octokit.pulls.listFiles({
      owner: repo.ownerLogin,
      repo: repo.repoName,
      pull_number: payload.pullNumber,
      per_page: 100,
    })

    const headSha = payload.refSha
      ? payload.refSha
      : (
          await octokit.pulls.get({
            owner: repo.ownerLogin,
            repo: repo.repoName,
            pull_number: payload.pullNumber,
          })
        ).data.head.sha

    const paths = prFiles.data
      .filter((f) => f.status !== 'removed' && !!f.filename)
      .map((f) => f.filename)

    const codebase: CodebaseFile[] = []
    for (const path of paths) {
      try {
        const content = await octokit.repos.getContent({
          owner: repo.ownerLogin,
          repo: repo.repoName,
          path,
          ref: headSha,
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
      logger.error('Failed to find stories in pull request', {
        repoId: payload.repoId,
        pullNumber: payload.pullNumber,
        error: result.error,
      })
      throw new Error(result.error || 'Failed to find stories in pull request')
    }

    logger.info('Stories found in pull request', {
      repoId: payload.repoId,
      pullNumber: payload.pullNumber,
      storyCount: result.storyCount,
    })

    return {
      success: true,
      storyCount: result.storyCount,
      stories: result.stories,
    }
  },
})
