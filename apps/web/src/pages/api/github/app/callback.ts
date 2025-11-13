import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import type { APIRoute } from 'astro'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'

import { db } from '@/server/db'
import { env } from '@/server/env'

const githubAppCallbackQuerySchema = z.object({
  installation_id: z.coerce.number(),
  setup_action: z.enum(['install', 'update']).optional(),
  state: z.string().optional(),
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

async function fetchInstallationAccount(
  installationId: number,
): Promise<{ account: GithubAccount; octokit: Octokit }> {
  const octokit = createOctokit(installationId)
  const installation = await octokit.apps.getInstallation({
    installation_id: installationId,
  })

  const account = githubAccountSchema.parse(installation.data.account)

  return { account, octokit }
}

async function upsertInstallationOwner(installationId: number): Promise<void> {
  const { account, octokit } = await fetchInstallationAccount(installationId)

  const accountName = await resolveAccountName(octokit, account)

  const ownerExternalId = account.id

  const ownerValues = {
    login: account.login,
    name: accountName,
    type: account.type,
    avatarUrl: account.avatar_url,
    htmlUrl: account.html_url,
    externalId: ownerExternalId,
    installationId: installationId,
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
    .returning(['id'])
    .executeTakeFirst()

  if (!owner) {
    throw new Error('Failed to upsert GitHub organization record')
  }
}

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url)
  const parsed = githubAppCallbackQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  )
  if (!parsed.success) {
    return new Response('Invalid callback query', { status: 400 })
  }

  const { installation_id } = parsed.data

  try {
    await upsertInstallationOwner(installation_id)

    await tasks.trigger(
      'sync-github-installation',
      {
        installationId: installation_id,
      },
      {
        tags: [`install_${installation_id}`],
      },
    )
  } catch (error) {
    console.error('Failed to trigger GitHub installation sync:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined
    return new Response(
      `Failed to sync installation${errorDetails ? `: ${errorDetails}` : ''}`,
      { status: 500 },
    )
  }

  return redirect('/app')
}
