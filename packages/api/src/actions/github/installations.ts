import type { DB } from '@app/db/types'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export const githubAppCallbackQuerySchema = z.object({
  installation_id: z.coerce.number(),
  setup_action: z.enum(['install', 'update']).optional(),
  state: z.string().optional(),
})

export type GithubAppCallbackQuery = z.infer<
  typeof githubAppCallbackQuerySchema
>

interface SyncInstallationParams {
  db: Kysely<DB>
  appId: number
  privateKey: string
  installationId: number
}

export async function syncGithubInstallation(
  params: SyncInstallationParams,
): Promise<{
  ownerId: string
  ownerLogin: string
  repoCount: number
}> {
  const { db, appId, privateKey, installationId } = params

  const installationOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  })

  const installation = await installationOctokit.apps.getInstallation({
    installation_id: installationId,
  })
  const account = installation.data.account as unknown as {
    id?: number
    login?: string
    name?: string
    type?: string
    avatar_url?: string
    html_url?: string
    slug?: string
  }
  const ownerExternalId = account?.id
  const ownerLogin =
    account && 'login' in account && account.login
      ? (account.login as string)
      : (account?.slug ?? account?.name ?? '')

  // Upsert owner
  const installationIdBigInt = BigInt(installationId)
  const owner = await db
    .insertInto('owners')
    .values({
      externalId: ownerExternalId ?? null,
      login: ownerLogin,
      name: account?.name ?? null,
      type: account?.type ?? null,
      avatarUrl: account?.avatar_url ?? null,
      htmlUrl: account?.html_url ?? null,
      installationId: installationIdBigInt,
    })
    .onConflict((oc) =>
      oc.column('login').doUpdateSet({
        externalId: ownerExternalId ?? null,
        name: account?.name ?? null,
        type: account?.type ?? null,
        avatarUrl: account?.avatar_url ?? null,
        htmlUrl: account?.html_url ?? null,
        installationId: installationIdBigInt,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()

  // Fetch repositories for the installation
  const reposResponse = await installationOctokit.paginate(
    installationOctokit.apps.listReposAccessibleToInstallation,
    {
      per_page: 100,
    },
  )

  // Upsert repos; preserve existing enabled flag if present
  let repoCount = 0
  for (const repo of reposResponse as Array<{
    id: number
    name: string
    full_name?: string
    private?: boolean
    description?: string | null
    default_branch?: string
    html_url?: string
  }>) {
    const repoExternalId = BigInt(repo.id)
    // Use number for where clause (Int8 accepts number | bigint | string)
    const existing = await db
      .selectFrom('repos')
      .selectAll()
      .where('externalId', '=', repo.id as unknown as never)
      .executeTakeFirst()

    const enabled =
      (existing as unknown as { enabled?: boolean } | undefined)?.enabled ??
      false

    await db
      .insertInto('repos')
      .values({
        ownerId: owner.id,
        externalId: repoExternalId,
        name: repo.name,
        fullName: repo.full_name ?? null,
        private: repo.private ?? false,
        description: repo.description ?? null,
        defaultBranch: repo.default_branch ?? null,
        htmlUrl: repo.html_url ?? null,
        enabled,
      })
      .onConflict((oc) =>
        oc.columns(['ownerId', 'name']).doUpdateSet({
          fullName: repo.full_name ?? null,
          private: repo.private ?? false,
          description: repo.description ?? null,
          defaultBranch: repo.default_branch ?? null,
          htmlUrl: repo.html_url ?? null,
          enabled,
        }),
      )
      .execute()

    repoCount += 1
  }

  return { ownerId: owner.id, ownerLogin, repoCount }
}

interface SetEnabledReposParams {
  db: Kysely<DB>
  ownerLogin: string
  repoNames: string[]
}

export async function setEnabledRepos(
  params: SetEnabledReposParams,
): Promise<{ updated: number }> {
  const { db, ownerLogin, repoNames } = params

  const owner = await db
    .selectFrom('owners')
    .selectAll()
    .where('login', '=', ownerLogin)
    .executeTakeFirst()

  if (!owner) {
    return { updated: 0 }
  }

  // Disable all repos for owner
  await db
    .updateTable('repos')
    .set({ enabled: false })
    .where('ownerId', '=', owner.id)
    .execute()

  if (repoNames.length === 0) {
    return { updated: 0 }
  }

  // Enable selected repos
  const result = await db
    .updateTable('repos')
    .set({ enabled: true })
    .where('ownerId', '=', owner.id)
    .where('name', 'in', repoNames)
    .executeTakeFirst()

  // Kysely's update result does not always have rowCount across drivers; return count conservatively
  return {
    updated: Array.isArray(result)
      ? result.length
      : (result as unknown as { numUpdatedOrDeletedRows?: bigint })
            .numUpdatedOrDeletedRows
        ? Number(
            (result as unknown as { numUpdatedOrDeletedRows: bigint })
              .numUpdatedOrDeletedRows,
          )
        : repoNames.length,
  }
}
