import { parseEnv } from '@app/config'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import { createOctokit } from '../../../helpers/github'
import { runCiTask } from '../../ci/main'
import { findRepoByOwnerAndName, type RepoLookupResult } from '../shared/db'
import { pushEventSchema } from '../shared/schemas'
import {
  extractBranchNameFromRef,
  resolveRepositoryOwnerLogin,
} from '../shared/utils'
import type { WebhookHandler } from '../types'

function isRepoEnabled(
  repo: RepoLookupResult | null,
): repo is RepoLookupResult {
  return repo !== null && repo.enabled
}

export const pushHandler: WebhookHandler = async ({
  deliveryId,
  rawPayload,
}) => {
  const parsed = pushEventSchema.safeParse(rawPayload)

  if (!parsed.success) {
    logger.error('Failed to parse push event payload', {
      deliveryId,
      issues: parsed.error.issues,
    })
    throw parsed.error
  }

  const branchName = extractBranchNameFromRef(parsed.data.ref)

  if (!branchName) {
    logger.info('Ignoring push event for non-branch ref', {
      deliveryId,
      ref: parsed.data.ref,
    })
    return
  }

  const ownerLogin = resolveRepositoryOwnerLogin(
    parsed.data.repository.owner ?? null,
  )

  if (!ownerLogin) {
    logger.warn('Unable to determine repository owner for push event', {
      deliveryId,
      repository: parsed.data.repository.name,
    })
    return
  }

  const repoName = parsed.data.repository.name
  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  try {
    const repoRecord = await findRepoByOwnerAndName(db, {
      ownerLogin,
      repoName,
    })

    if (!isRepoEnabled(repoRecord)) {
      logger.info('Skipping push event for disabled or unknown repository', {
        deliveryId,
        ownerLogin,
        repoName,
      })
      return
    }

    // Check if this branch has an open pull request
    // If it does, skip this push handler - let pull_request handler handle it
    const owner = await db
      .selectFrom('owners')
      .select('installationId')
      .where('id', '=', repoRecord.ownerId)
      .executeTakeFirst()

    if (owner?.installationId) {
      const octokit = createOctokit(Number(owner.installationId))

      try {
        const prs = await octokit.rest.pulls.list({
          owner: ownerLogin,
          repo: repoName,
          head: `${ownerLogin}:${branchName}`,
          state: 'open',
          per_page: 1,
        })

        if (prs.data.length > 0) {
          logger.info(
            'Skipping push event; branch has open PR, will be handled by pull_request event',
            {
              deliveryId,
              ownerLogin,
              repoName,
              branchName,
              prNumber: prs.data[0]?.number,
            },
          )
          return
        }
      } catch (error) {
        // If API call fails, log but don't block the push handler
        // This ensures we don't miss CI runs if GitHub API is down
        logger.warn('Failed to check for open PRs, proceeding with push handler', {
          deliveryId,
          ownerLogin,
          repoName,
          branchName,
          error,
        })
      }
    }

    const commitSha = parsed.data.after ?? null
    const headCommit = parsed.data.head_commit
    const commitMessage = headCommit?.message ?? null
    const commitAuthor = headCommit?.author
    const gitAuthor = commitAuthor
      ? {
          id:
            commitAuthor.id !== null && commitAuthor.id !== undefined
              ? typeof commitAuthor.id === 'bigint'
                ? Number(commitAuthor.id)
                : commitAuthor.id
              : null,
          login: commitAuthor.login ?? null,
          name: commitAuthor.name ?? null,
        }
      : null

    await runCiTask.trigger(
      {
        orgName: ownerLogin,
        repoName,
        branchName,
        commitSha,
        commitMessage,
        gitAuthor,
      },
      {
        tags: [
          `org_${ownerLogin}`,
          `repo_${repoName}`,
          `branch_${branchName}`,
          `commit_${commitSha?.slice(0, 7)}`,
        ],
      },
    )

    logger.info('Queued CI run from push event', {
      deliveryId,
      ownerLogin,
      repoName,
      branchName,
      commitSha: parsed.data.after ?? null,
    })
  } catch (error) {
    logger.error('Failed to queue CI run from push event', {
      deliveryId,
      ownerLogin,
      repoName,
      error,
    })
    throw error
  } finally {
    await db.destroy()
  }
}
