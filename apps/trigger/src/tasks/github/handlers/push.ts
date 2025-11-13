import { parseEnv, AGENT_CONFIG, type AgentVersion } from '@app/agents'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

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

    const agentVersion: AgentVersion = AGENT_CONFIG.version
    await runCiTask.trigger({
      orgSlug: ownerLogin,
      repoName,
      branchName,
      agentVersion,
    })

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
