import { parseEnv } from '@app/agents'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import {
  disableAllReposAndClearInstallation,
  setRepositoriesEnabledForOwner,
  upsertOwnerRecord,
  upsertRepositories,
} from '../shared/db'
import { installationEventSchema } from '../shared/schemas'
import { parseId } from '../shared/utils'
import type { WebhookHandler } from '../types'

export const installationHandler: WebhookHandler = async ({
  deliveryId,
  rawPayload,
}) => {
  const parsed = installationEventSchema.parse(rawPayload)
  const { installation, repositories = [] } = parsed
  const action = parsed.action.toLowerCase()
  const installationId = parseId(installation.id, 'installation.id')

  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  try {
    const owner = await upsertOwnerRecord(db, {
      account: installation.account,
      installationId,
    })

    switch (action) {
      case 'deleted': {
        await disableAllReposAndClearInstallation(db, owner.id)

        logger.info('Processed installation deletion event', {
          deliveryId,
          installationId: String(installationId),
          ownerLogin: owner.login,
        })
        break
      }

      case 'suspend':
      case 'suspended': {
        await setRepositoriesEnabledForOwner(db, {
          ownerId: owner.id,
          enabled: false,
        })

        logger.info('Processed installation suspension event', {
          deliveryId,
          installationId: String(installationId),
          ownerLogin: owner.login,
        })
        break
      }

      case 'unsuspend':
      case 'unsuspended': {
        await setRepositoriesEnabledForOwner(db, {
          ownerId: owner.id,
          enabled: true,
        })

        logger.info('Processed installation unsuspension event', {
          deliveryId,
          installationId: String(installationId),
          ownerLogin: owner.login,
        })
        break
      }

      default: {
        if (repositories.length > 0) {
          await upsertRepositories(db, {
            ownerId: owner.id,
            repositories,
            enabled: false,
          })
        }

        logger.info('Processed installation event', {
          deliveryId,
          action,
          installationId: String(installationId),
          ownerLogin: owner.login,
          repositoryCount: repositories.length,
        })
      }
    }
  } finally {
    await db.destroy()
  }
}

