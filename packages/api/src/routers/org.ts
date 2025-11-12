import { TRPCError } from '@trpc/server'
import { configure, tasks } from '@trigger.dev/sdk'

import { parseEnv } from '../helpers/env'
import { router, protectedProcedure } from '../trpc'

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
    const userId = ctx.user?.id

    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    const owners = await ctx.db
      .selectFrom('owners')
      .innerJoin('ownerMemberships', 'ownerMemberships.ownerId', 'owners.id')
      .select([
        'owners.id as ownerId',
        'owners.login as slug',
        'owners.name as accountName',
      ])
      .where('owners.installationId', 'is not', null)
      .where('ownerMemberships.userId', '=', userId)
      .orderBy('owners.login')
      .execute()

    const ownerIds = owners.map((owner) => owner.ownerId)

    const repoCounts =
      ownerIds.length === 0
        ? []
        : await ctx.db
            .selectFrom('repoMemberships')
            .innerJoin('repos', 'repos.id', 'repoMemberships.repoId')
            .select((eb) => [
              'repos.ownerId as ownerId',
              eb.fn
                .count('repoMemberships.id')
                .filterWhere('repos.enabled', '=', true)
                .as('count'),
            ])
            .where('repoMemberships.userId', '=', userId)
            .where('repos.ownerId', 'in', ownerIds)
            .groupBy('repos.ownerId')
            .execute()

    const repoCountByOwner = new Map(
      repoCounts.map((entry) => [entry.ownerId, Number(entry.count ?? 0)]),
    )

    return {
      orgs: owners.map((owner) => ({
        slug: owner.slug,
        name: owner.accountName ?? owner.slug,
        accountName: owner.accountName ?? null,
        repoCount: repoCountByOwner.get(owner.ownerId) ?? 0,
      })),
    }
  }),

  refreshInstallations: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user?.id

    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }

    const installationRows = await ctx.db
      .selectFrom('owners')
      .innerJoin('ownerMemberships', 'ownerMemberships.ownerId', 'owners.id')
      .select([
        'owners.installationId as installationId',
        'owners.login as login',
      ])
      .where('owners.installationId', 'is not', null)
      .where('ownerMemberships.userId', '=', userId)
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
})
