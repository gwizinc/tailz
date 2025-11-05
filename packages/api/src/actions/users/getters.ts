import type { DB, User } from '@app/db/types'
import type { Kysely, Selectable } from 'kysely'

import { trpcNotFoundError } from '../../helpers/kysely-trprc'

/**
 * Retrieves a user by ID
 * @param db - Database instance
 * @param userId - The user ID to retrieve
 * @returns The user if found
 * @throws TRPCError with NOT_FOUND if user doesn't exist
 */
export async function getUser({
  db,
  userId,
}: {
  db: Kysely<DB>
  userId: string
}): Promise<Selectable<User>> {
  return await db
    .selectFrom('users')
    .where('id', '=', userId)
    .selectAll()
    .executeTakeFirstOrThrow(trpcNotFoundError)
}

/**
 * Lists all users
 * @param db - Database instance
 * @returns Array of users
 */
export async function listUsers({
  db,
}: {
  db: Kysely<DB>
}): Promise<Selectable<User>[]> {
  return await db.selectFrom('users').selectAll().execute()
}
