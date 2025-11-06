import { task, logger } from '@trigger.dev/sdk'
import { setupDb } from '@app/db'
import { parseEnv } from '../helpers/env'

/**
 * Task to update which repositories are enabled for a given owner.
 *
 * This task performs a two-step operation:
 * 1. Disables all repositories for the specified owner
 * 2. Enables only the repositories specified in the `repoNames` array
 *
 * @param payload - Configuration for enabling repositories
 * @param payload.ownerLogin - The GitHub login/username of the owner
 * @param payload.repoNames - Array of repository names to enable. If empty, all repos will be disabled.
 *
 * @returns Object containing the number of repositories that were updated
 * @returns {number} updated - Number of repositories that were enabled (0 if owner not found or no repos to enable)
 *
 * @example
 * ```typescript
 * await setEnabledReposTask.trigger({
 *   ownerLogin: 'myorg',
 *   repoNames: ['repo1', 'repo2', 'repo3']
 * })
 * ```
 */
export const setEnabledReposTask = task({
  id: 'set-enabled-repos',
  run: async (
    payload: {
      ownerLogin: string
      repoNames: string[]
    },
    { ctx: _ctx },
  ) => {
    logger.info('Setting enabled repos', {
      ownerLogin: payload.ownerLogin,
      repoCount: payload.repoNames.length,
    })

    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    const owner = await db
      .selectFrom('owners')
      .selectAll()
      .where('login', '=', payload.ownerLogin)
      .executeTakeFirst()

    if (!owner) {
      logger.info('Owner not found', { ownerLogin: payload.ownerLogin })
      return { updated: 0 }
    }

    await db
      .updateTable('repos')
      .set({ enabled: false })
      .where('ownerId', '=', owner.id)
      .execute()

    if (payload.repoNames.length === 0) {
      logger.info('No repos to enable', { ownerLogin: payload.ownerLogin })
      return { updated: 0 }
    }

    const result = await db
      .updateTable('repos')
      .set({ enabled: true })
      .where('ownerId', '=', owner.id)
      .where('name', 'in', payload.repoNames)
      .executeTakeFirst()

    const updated = Array.isArray(result)
      ? result.length
      : (result as unknown as { numUpdatedOrDeletedRows?: bigint })
            .numUpdatedOrDeletedRows
        ? Number(
            (result as unknown as { numUpdatedOrDeletedRows: bigint })
              .numUpdatedOrDeletedRows,
          )
        : payload.repoNames.length

    logger.info('Enabled repos updated', {
      ownerLogin: payload.ownerLogin,
      updated,
    })

    return { updated }
  },
})
