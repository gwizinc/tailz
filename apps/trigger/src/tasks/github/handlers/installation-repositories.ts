import { parseEnv } from '@app/agents'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import { disableRepositories, upsertRepositories } from '../shared/db'
import { installationRepositoriesEventSchema } from '../shared/schemas'
import { parseId } from '../shared/utils'
import type { WebhookHandler } from '../types'

export const installationRepositoriesHandler: WebhookHandler = async ({
  deliveryId,
  rawPayload,
}) => {
  const parsed = installationRepositoriesEventSchema.parse(rawPayload)
  const installationId = parseId(parsed.installation.id, 'installation.id')
  const installationIdValue = installationId.toString()

  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  try {
    const owner = await db
      .selectFrom('owners')
      .select(['id', 'login'])
      .where('installationId', '=', installationIdValue)
      .executeTakeFirst()

    if (!owner) {
      logger.warn('Owner not found for installation_repositories event', {
        deliveryId,
        installationId: installationIdValue,
      })

      return
    }

    const repositoriesAdded = parsed.repositories_added ?? []
    const repositoriesRemoved = parsed.repositories_removed ?? []

    if (repositoriesAdded.length > 0) {
      await upsertRepositories(db, {
        ownerId: owner.id,
        repositories: repositoriesAdded,
        enabled: true,
      })
    }

    if (repositoriesRemoved.length > 0) {
      await disableRepositories(db, {
        ownerId: owner.id,
        repositories: repositoriesRemoved,
      })
    }

    logger.info('Processed installation_repositories event', {
      deliveryId,
      action: parsed.action,
      installationId: installationIdValue,
      ownerLogin: owner.login,
      repositoriesAdded: repositoriesAdded.length,
      repositoriesRemoved: repositoriesRemoved.length,
    })
  } finally {
    await db.destroy()
  }
}

