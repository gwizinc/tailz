import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import type { APIRoute } from 'astro'
import { z } from 'zod'

import { db } from '@/server/db'
import { env } from '@/server/env'

const syncInstallationQuerySchema = z.object({
  installation_id: z.coerce.number(),
})

const githubAccountSchema = z
  .object({
    login: z.string(),
    id: z.union([z.number(), z.string()]).optional(),
    name: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    html_url: z.string().nullable().optional(),
  })
  .passthrough()

type GithubAccount = z.infer<typeof githubAccountSchema>

function createOctokit(installationId: number): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.githubAppId,
      privateKey: env.githubAppPrivateKey,
      installationId,
    },
  })
}

async function resolveAccountName(
  octokit: Octokit,
  account: GithubAccount,
): Promise<string | null> {
  const existingName = account.name ?? null

  if (existingName) {
    return existingName
  }

  const accountType = account.type ?? null

  try {
    if (accountType === 'Organization') {
      const org = await octokit.rest.orgs.get({ org: account.login })
      return org.data.name ?? null
    }

    const user = await octokit.rest.users.getByUsername({
      username: account.login,
    })

    return user.data.name ?? null
  } catch (error) {
    console.error('Failed to resolve GitHub account name', {
      login: account.login,
      error,
    })
    return null
  }
}

function getAccountType(account: GithubAccount): string | null {
  return typeof account.type === 'string' && account.type.length > 0
    ? account.type
    : null
}

async function fetchGithubMemberIdentifiers(
  octokit: Octokit,
  account: GithubAccount,
): Promise<readonly string[]> {
  const accountType = getAccountType(account)?.toLowerCase() ?? null

  if (accountType === 'organization') {
    try {
      const members = await octokit.paginate(octokit.rest.orgs.listMembers, {
        org: account.login,
        per_page: 100,
        role: 'all',
      })

      return members
        .map((member) => {
          if (
            typeof member.id === 'string' ||
            typeof member.id === 'number' ||
            typeof member.id === 'bigint'
          ) {
            const id = String(member.id).trim()
            if (id.length > 0) {
              return id
            }
          }

          const login =
            typeof member.login === 'string' ? member.login.trim() : ''

          return login.length > 0 ? login : null
        })
        .filter((value): value is string => value !== null)
    } catch (error) {
      console.warn('Failed to fetch GitHub organization members', {
        ownerLogin: account.login,
        error,
      })

      return []
    }
  }

  // For user accounts, return the account identifier
  const accountId = account.id
  if (
    typeof accountId === 'string' ||
    typeof accountId === 'number' ||
    typeof accountId === 'bigint'
  ) {
    const id = String(accountId).trim()
    if (id.length > 0) {
      return [id]
    }
  }

  const login = account.login.trim()
  return login.length > 0 ? [login] : []
}

async function mapGithubMembersToLocalUserIds(
  githubIdentifiers: readonly string[],
): Promise<string[]> {
  const uniqueIdentifiers = Array.from(new Set(githubIdentifiers))

  if (uniqueIdentifiers.length === 0) {
    return []
  }

  const accountIdVariants = uniqueIdentifiers.flatMap((identifier) => {
    const trimmed = identifier.trim()
    if (trimmed.length === 0) {
      return []
    }
    return [trimmed, `github:${trimmed}`, `github|${trimmed}`]
  })

  const matchedAccounts = await db
    .selectFrom('accounts')
    .select(['userId', 'accountId'])
    .where('providerId', '=', 'github')
    .where('accountId', 'in', accountIdVariants)
    .execute()

  const memberUserIds = new Set<string>()

  for (const account of matchedAccounts) {
    memberUserIds.add(account.userId)
  }

  return Array.from(memberUserIds)
}

async function ensureOwnerMemberships(
  ownerId: string,
  userIds: readonly string[],
  role: string = 'member',
): Promise<void> {
  const uniqueUserIds = Array.from(new Set(userIds))

  if (uniqueUserIds.length === 0) {
    return
  }

  await db
    .insertInto('ownerMemberships')
    .values(
      uniqueUserIds.map((userId) => ({
        ownerId,
        userId,
        role,
      })),
    )
    .onConflict((oc) =>
      oc.columns(['ownerId', 'userId']).doUpdateSet({
        role,
      }),
    )
    .execute()
}

async function pruneOwnerMemberships(
  ownerId: string,
  keepUserIds: readonly string[],
): Promise<void> {
  if (keepUserIds.length === 0) {
    await db
      .deleteFrom('ownerMemberships')
      .where('ownerId', '=', ownerId)
      .execute()
    return
  }

  await db
    .deleteFrom('ownerMemberships')
    .where('ownerId', '=', ownerId)
    .where('userId', 'not in', Array.from(new Set(keepUserIds)))
    .execute()
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const parsed = syncInstallationQuerySchema.parse(body)

    const { installation_id } = parsed

    const octokit = createOctokit(installation_id)
    const installation = await octokit.apps.getInstallation({
      installation_id: installation_id,
    })

    const account = githubAccountSchema.parse(installation.data.account)

    if (!account.login) {
      return new Response('Missing account information', { status: 400 })
    }

    const accountName = await resolveAccountName(octokit, account)

    const ownerExternalId =
      typeof account.id === 'number' || typeof account.id === 'string'
        ? BigInt(String(account.id))
        : null

    const ownerValues = {
      login: account.login,
      name: accountName,
      type: account.type ?? null,
      avatarUrl: account.avatar_url ?? null,
      htmlUrl: account.html_url ?? null,
      externalId: ownerExternalId,
      installationId: BigInt(installation_id),
    }

    const owner = await db
      .insertInto('owners')
      .values(ownerValues)
      .onConflict((oc) =>
        oc.column('login').doUpdateSet({
          name: ownerValues.name,
          type: ownerValues.type,
          avatarUrl: ownerValues.avatarUrl,
          htmlUrl: ownerValues.htmlUrl,
          externalId: ownerValues.externalId,
          installationId: ownerValues.installationId,
        }),
      )
      .returning(['id', 'login'])
      .executeTakeFirst()

    if (!owner) {
      return new Response('Failed to upsert owner record', { status: 500 })
    }

    const githubMemberIdentifiers = await fetchGithubMemberIdentifiers(
      octokit,
      account,
    )
    const memberUserIds = await mapGithubMembersToLocalUserIds(
      githubMemberIdentifiers,
    )

    if (memberUserIds.length > 0) {
      await ensureOwnerMemberships(owner.id, memberUserIds)
      await pruneOwnerMemberships(owner.id, memberUserIds)
    }

    return new Response(
      JSON.stringify({
        success: true,
        installationId: installation_id,
        ownerLogin: owner.login,
        memberCount: memberUserIds.length,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Failed to sync GitHub installation:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined

    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to sync installation${errorDetails ? `: ${errorDetails}` : ''}`,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
