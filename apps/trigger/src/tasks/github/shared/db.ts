import { setupDb } from '@app/db'
import { logger } from '@trigger.dev/sdk'

import type { AccountPayload, RepositoryPayload } from './schemas'
import { parseId, resolveAccountExternalId, toNullableString } from './utils'

export type DbClient = ReturnType<typeof setupDb>

export async function upsertOwnerRecord(
  db: DbClient,
  params: {
    account: AccountPayload
    installationId: bigint
  },
): Promise<{ id: string; login: string }> {
  const accountName = toNullableString(params.account.name ?? null)
  const accountType = toNullableString(params.account.type ?? null)
  const avatarUrl = toNullableString(params.account.avatar_url ?? null)
  const htmlUrl = toNullableString(params.account.html_url ?? null)
  const externalId = resolveAccountExternalId(params.account)

  const owner = await db
    .insertInto('owners')
    .values({
      login: params.account.login,
      name: accountName,
      type: accountType,
      avatarUrl,
      htmlUrl,
      externalId,
      installationId: params.installationId,
    })
    .onConflict((oc) =>
      oc.column('login').doUpdateSet({
        name: accountName,
        type: accountType,
        avatarUrl,
        htmlUrl,
        externalId,
        installationId: params.installationId,
      }),
    )
    .returning(['id', 'login'])
    .executeTakeFirst()

  if (!owner) {
    throw new Error('Failed to upsert owner record')
  }

  return owner
}

export async function upsertRepositories(
  db: DbClient,
  params: {
    ownerId: string
    repositories: RepositoryPayload[]
    enabled: boolean
  },
): Promise<void> {
  if (params.repositories.length === 0) {
    return
  }

  await db.transaction().execute(async (trx) => {
    for (const repo of params.repositories) {
      const externalId =
        repo.id === undefined ? null : parseId(repo.id, 'repository.id')

      await trx
        .insertInto('repos')
        .values({
          ownerId: params.ownerId,
          externalId,
          name: repo.name,
          fullName: repo.full_name ?? null,
          description: repo.description ?? null,
          defaultBranch: repo.default_branch ?? null,
          htmlUrl: repo.html_url ?? null,
          private: repo.private ?? false,
          enabled: params.enabled,
        })
        .onConflict((oc) =>
          oc.columns(['ownerId', 'name']).doUpdateSet({
            externalId,
            fullName: repo.full_name ?? null,
            description: repo.description ?? null,
            defaultBranch: repo.default_branch ?? null,
            htmlUrl: repo.html_url ?? null,
            private: repo.private ?? false,
            enabled: params.enabled,
          }),
        )
        .execute()
    }
  })
}

export async function disableRepositories(
  db: DbClient,
  params: {
    ownerId: string
    repositories: RepositoryPayload[]
  },
): Promise<void> {
  if (params.repositories.length === 0) {
    return
  }

  const externalIds: string[] = []
  const names = new Set<string>()

  for (const repo of params.repositories) {
    if (repo.id !== undefined) {
      try {
        externalIds.push(parseId(repo.id, 'repository.id').toString())
        continue
      } catch (error) {
        logger.warn('Failed to parse repository id when disabling repo', {
          error,
          repositoryId: repo.id,
          repositoryName: repo.name,
        })
      }
    }

    names.add(repo.name)
  }

  await db.transaction().execute(async (trx) => {
    if (externalIds.length > 0) {
      await trx
        .updateTable('repos')
        .set({ enabled: false })
        .where('ownerId', '=', params.ownerId)
        .where('externalId', 'in', externalIds)
        .execute()
    }

    const nameList = Array.from(names)

    if (nameList.length > 0) {
      await trx
        .updateTable('repos')
        .set({ enabled: false })
        .where('ownerId', '=', params.ownerId)
        .where('name', 'in', nameList)
        .execute()
    }
  })
}

export async function setRepositoriesEnabledForOwner(
  db: DbClient,
  params: { ownerId: string; enabled: boolean },
): Promise<void> {
  await db
    .updateTable('repos')
    .set({ enabled: params.enabled })
    .where('ownerId', '=', params.ownerId)
    .execute()
}

export async function disableAllReposAndClearInstallation(
  db: DbClient,
  ownerId: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('repos')
      .set({ enabled: false })
      .where('ownerId', '=', ownerId)
      .execute()

    await trx
      .updateTable('owners')
      .set({ installationId: null })
      .where('id', '=', ownerId)
      .execute()
  })
}

