import { parseEnv } from '@app/config'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import {
  disableAllReposAndClearInstallation,
  ensureOwnerMemberships,
  ensureRepoMemberships,
  findRepoIdsByNames,
  findRepoIdsByOwnerId,
  findUserIdsByGithubAccountId,
  listOwnerMemberUserIds,
  removeAllMembershipsForOwner,
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

    const senderUserIds = await findUserIdsByGithubAccountId(
      db,
      parsed.sender?.id ?? null,
    )

    if (senderUserIds.length === 0) {
      logger.info('No matching local users for GitHub sender', {
        deliveryId,
        senderLogin: parsed.sender?.login ?? null,
        senderId: parsed.sender?.id ?? null,
      })
    } else {
      await ensureOwnerMemberships(db, {
        ownerId: owner.id,
        userIds: senderUserIds,
        role: 'admin',
      })
    }

    switch (action) {
      case 'deleted': {
        await disableAllReposAndClearInstallation(db, owner.id)
        await removeAllMembershipsForOwner(db, owner.id)

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

        const memberUserIds = await listOwnerMemberUserIds(db, owner.id)

        if (memberUserIds.length > 0) {
          const repoIds =
            repositories.length > 0
              ? await findRepoIdsByNames(db, {
                  ownerId: owner.id,
                  repoNames: repositories.map((repo) => repo.name),
                })
              : await findRepoIdsByOwnerId(db, owner.id)

          await ensureRepoMemberships(db, {
            repoIds,
            userIds: memberUserIds,
          })
        }

        logger.info('Processed installation event', {
          deliveryId,
          action,
          installationId: String(installationId),
          ownerLogin: owner.login,
          repositoryCount: repositories.length,
          memberCount: memberUserIds.length,
        })
      }
    }
  } finally {
    await db.destroy()
  }
}
