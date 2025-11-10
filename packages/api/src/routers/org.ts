import { configure, tasks } from '@trigger.dev/sdk'

import { parseEnv } from '../helpers/env'
import {
  listGithubAppInstallations,
  type GithubInstallationSummary,
} from '../helpers/github-app'
import { router, protectedProcedure } from '../trpc'

function formatTriggerError(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message
  }

  if (typeof reason === 'string') {
    return reason
  }

  try {
    return JSON.stringify(reason)
  } catch {
    return String(reason)
  }
}

export const orgRouter = router({
  getDefault: protectedProcedure.query(() => {
    return {
      org: {
        id: 'demo-org',
        slug: 'demo-org',
        name: 'Demo Org',
      },
    }
  }),
  listInstalled: protectedProcedure.query(async ({ ctx }) => {
    const owners = await ctx.db
      .selectFrom('owners')
      .leftJoin('repos', 'owners.id', 'repos.ownerId')
      .select((eb) => [
        eb.ref('owners.login').as('slug'),
        eb.ref('owners.name').as('accountName'),
        eb.fn
          .count('repos.id')
          .filterWhere('repos.enabled', '=', true)
          .as('repoCount'),
      ])
      .where('owners.installationId', 'is not', null)
      .groupBy(['owners.login', 'owners.name'])
      .orderBy('owners.login')
      .execute()

    return {
      orgs: owners.map((owner) => ({
        slug: owner.slug,
        name: owner.accountName ?? owner.slug,
        accountName: owner.accountName ?? null,
        repoCount: Number(owner.repoCount ?? 0),
      })),
    }
  }),
  getSetupStatus: protectedProcedure.query(async ({ ctx }) => {
    const installed = await ctx.db
      .selectFrom('owners')
      .select(['id'])
      .where('installationId', 'is not', null)
      .executeTakeFirst()

    if (!installed) {
      return { hasInstallation: false, hasEnabledRepos: false }
    }

    const enabledRepo = await ctx.db
      .selectFrom('repos')
      .select(['id'])
      .where('enabled', '=', true)
      .executeTakeFirst()

    return { hasInstallation: true, hasEnabledRepos: Boolean(enabledRepo) }
  }),
  refreshInstallations: protectedProcedure.mutation(async ({ ctx }) => {
    const installationRows = await ctx.db
      .selectFrom('owners')
      .select(['installationId', 'login'])
      .where('installationId', 'is not', null)
      .execute()

    const installations = installationRows
      .map((row) => {
        if (row.installationId === null) {
          return null
        }

        const parsed = Number.parseInt(String(row.installationId), 10)

        if (!Number.isFinite(parsed)) {
          console.warn(
            `Skipping invalid installation id for owner ${row.login}: ${row.installationId}`,
          )
          return null
        }

        return {
          installationId: parsed,
          login: row.login,
        }
      })
      .filter(
        (value): value is { installationId: number; login: string } =>
          value !== null,
      )

    if (installations.length === 0) {
      return {
        triggered: 0,
        total: 0,
        failed: 0,
      }
    }

    const env = parseEnv(ctx.env)

    configure({
      secretKey: env.TRIGGER_SECRET_KEY,
    })

    const results = await Promise.allSettled(
      installations.map((installation) =>
        tasks.trigger('sync-github-installation', {
          installationId: installation.installationId,
        }),
      ),
    )

    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length

    return {
      triggered: installations.length - failed,
      total: installations.length,
      failed,
    }
  }),
  syncHubInstallations: protectedProcedure.mutation(async ({ ctx }) => {
    const env = parseEnv(ctx.env)

    const installationSummaries = await listGithubAppInstallations({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    })

    if (installationSummaries.length === 0) {
      return {
        triggered: 0,
        total: 0,
        failed: 0,
        installations: [],
      }
    }

    configure({
      secretKey: env.TRIGGER_SECRET_KEY,
    })

    const results = await Promise.allSettled<unknown>(
      installationSummaries.map((installation) =>
        tasks.trigger('sync-github-installation', {
          installationId: installation.installationId,
        }),
      ),
    )

    let failed = 0

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1

        const summary: GithubInstallationSummary | undefined =
          installationSummaries[index]
        const errorMessage = formatTriggerError(result.reason)

        console.error('Failed to trigger sync for installation', {
          installationId: summary?.installationId ?? null,
          error: errorMessage,
        })
      }
    })

    return {
      triggered: installationSummaries.length - failed,
      total: installationSummaries.length,
      failed,
      installations: installationSummaries,
    }
  }),
})
