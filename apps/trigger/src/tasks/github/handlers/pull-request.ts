import { parseEnv, AGENT_CONFIG, type AgentVersion } from '@app/agents'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import { runCiTask } from '../../ci/main'
import { findActiveRunForPr, findRepoByOwnerAndName } from '../shared/db'
import { pullRequestEventSchema } from '../shared/schemas'
import { resolveRepositoryOwnerLogin, toNullableString } from '../shared/utils'
import type { WebhookHandler } from '../types'

const RUN_TRIGGER_ACTIONS = new Set([
  'opened',
  'reopened',
  'synchronize',
  'ready_for_review',
])

export const pullRequestHandler: WebhookHandler = async ({
  deliveryId,
  rawPayload,
}) => {
  const parsed = pullRequestEventSchema.safeParse(rawPayload)

  if (!parsed.success) {
    logger.error('Failed to parse pull_request event payload', {
      deliveryId,
      issues: parsed.error.issues,
    })
    throw parsed.error
  }

  const action = parsed.data.action.toLowerCase()

  if (!RUN_TRIGGER_ACTIONS.has(action)) {
    logger.info('Ignoring pull_request action', {
      deliveryId,
      action,
    })
    return
  }

  const repoName = parsed.data.repository.name
  const ownerLogin =
    resolveRepositoryOwnerLogin(parsed.data.repository.owner ?? null) ??
    resolveRepositoryOwnerLogin(
      parsed.data.pull_request.head.repo.owner ?? null,
    )

  if (!ownerLogin) {
    logger.warn('Unable to determine repository owner for pull_request event', {
      deliveryId,
      repoName,
      action,
    })
    return
  }

  const branchName = toNullableString(parsed.data.pull_request.head.ref)

  if (!branchName) {
    logger.warn('Skipping pull_request event due to missing head branch', {
      deliveryId,
      ownerLogin,
      repoName,
      action,
    })
    return
  }

  const prNumber = String(parsed.data.number ?? parsed.data.pull_request.number)
  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  try {
    const repoRecord = await findRepoByOwnerAndName(db, {
      ownerLogin,
      repoName,
    })

    if (!repoRecord) {
      logger.info('Pull request event ignored for unknown repository', {
        deliveryId,
        ownerLogin,
        repoName,
        prNumber,
      })
      return
    }

    if (!repoRecord.enabled) {
      logger.info('Pull request event ignored for disabled repository', {
        deliveryId,
        ownerLogin,
        repoName,
        prNumber,
      })
      return
    }

    const activeRun = await findActiveRunForPr(db, {
      repoId: repoRecord.repoId,
      prNumber,
    })

    if (activeRun) {
      logger.info('Skipping CI trigger; active PR run already in progress', {
        deliveryId,
        ownerLogin,
        repoName,
        prNumber,
        activeRunId: activeRun.id,
      })
      return
    }

    const agentVersion: AgentVersion = AGENT_CONFIG.version
    await runCiTask.trigger({
      orgSlug: ownerLogin,
      repoName,
      branchName,
      prNumber,
      agentVersion,
    })

    logger.info('Queued CI run from pull_request event', {
      deliveryId,
      ownerLogin,
      repoName,
      branchName,
      prNumber,
      action,
    })
  } catch (error) {
    logger.error('Failed to queue CI run from pull_request event', {
      deliveryId,
      ownerLogin,
      repoName,
      prNumber,
      action,
      error,
    })
    throw error
  } finally {
    await db.destroy()
  }
}
