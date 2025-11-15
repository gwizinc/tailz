import { parseEnv } from '@app/config'
import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import { parseId } from '../shared/utils'
import { installationTargetsEventSchema } from '../shared/schemas'
import type { WebhookHandler } from '../types'

export const installationTargetsHandler: WebhookHandler = async ({
  deliveryId,
  rawPayload,
}) => {
  const data = installationTargetsEventSchema.parse(rawPayload)
  const action = data.action.toLowerCase()

  if (action !== 'renamed') {
    logger.info('Ignoring installation_targets action', {
      deliveryId,
      action,
    })
    return
  }

  const installationId = parseId(data.installation.id, 'installation.id')
  const newLogin = data.account.login
  const oldLogin = data.changes?.login?.from

  if (!oldLogin) {
    logger.warn('Missing old login in installation_targets rename event', {
      deliveryId,
      installationId: installationId.toString(),
      newLogin,
    })
    return
  }

  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  try {
    // Find the owner by installation ID
    const owner = await db
      .selectFrom('owners')
      .select(['id', 'login'])
      .where('installationId', '=', installationId.toString())
      .executeTakeFirst()

    if (!owner) {
      logger.warn('Owner not found for installation_targets event', {
        deliveryId,
        installationId: installationId.toString(),
        oldLogin,
        newLogin,
      })
      return
    }

    // Verify the old login matches (safety check)
    if (owner.login.toLowerCase() !== oldLogin.toLowerCase()) {
      logger.warn('Owner login mismatch in installation_targets rename event', {
        deliveryId,
        installationId: installationId.toString(),
        expectedLogin: owner.login,
        oldLogin,
        newLogin,
      })
      return
    }

    // Update the owner's login
    await db
      .updateTable('owners')
      .set({
        login: newLogin,
        name: data.account.name ?? null,
        avatarUrl: data.account.avatar_url ?? null,
        htmlUrl: data.account.html_url ?? null,
      })
      .where('id', '=', owner.id)
      .execute()

    logger.info('Updated owner login from installation_targets rename event', {
      deliveryId,
      installationId: installationId.toString(),
      ownerId: owner.id,
      oldLogin,
      newLogin,
    })
  } catch (error) {
    logger.error(
      'Failed to update owner login from installation_targets event',
      {
        deliveryId,
        installationId: installationId.toString(),
        oldLogin,
        newLogin,
        error,
      },
    )
    throw error
  } finally {
    await db.destroy()
  }
}
