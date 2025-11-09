import { z } from 'zod'

import { protectedProcedure, router } from '../trpc'

type RepoListItemStatus = 'pass' | 'fail' | 'skipped' | 'running' | 'error'

type RepoListItem = {
  id: string
  name: string
  defaultBranch: string | null
  enabled: boolean
  isPrivate: boolean
  storyCount: number
  lastRunStatus: RepoListItemStatus | null
  lastRunAt: Date | null
}

export const repoRouter = router({
  listByOrg: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return {
          owner: null,
          repos: [] as RepoListItem[],
        }
      }

      const repos = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name', 'defaultBranch', 'enabled', 'private'])
        .where('ownerId', '=', owner.id)
        .orderBy('name')
        .execute()

      const repoIds = repos.map((repo) => repo.id)

      const storyCounts =
        repoIds.length === 0
          ? []
          : await ctx.db
              .selectFrom('stories')
              .select(['repoId'])
              .select((eb) => eb.fn.count('stories.id').as('count'))
              .where('repoId', 'in', repoIds)
              .groupBy('repoId')
              .execute()

      const latestRuns =
        repoIds.length === 0
          ? []
          : await ctx.db
              .with('latest_run_times', (db) =>
                db
                  .selectFrom('runs')
                  .select(['repoId'])
                  .select((eb) => eb.fn.max('createdAt').as('maxCreatedAt'))
                  .where('repoId', 'in', repoIds)
                  .groupBy('repoId'),
              )
              .selectFrom('runs')
              .innerJoin('latest_run_times', (join) =>
                join
                  .onRef('runs.repoId', '=', 'latest_run_times.repoId')
                  .onRef(
                    'runs.createdAt',
                    '=',
                    'latest_run_times.maxCreatedAt',
                  ),
              )
              .select([
                'runs.repoId as repoId',
                'runs.status as status',
                'runs.createdAt as createdAt',
              ])
              .execute()

      const storyCountByRepo = new Map(
        storyCounts.map((entry) => [entry.repoId, Number(entry.count)]),
      )

      const latestRunStatusByRepo = new Map<
        string,
        { status: RepoListItemStatus; createdAt: Date }
      >(
        latestRuns
          .filter(
            (
              entry,
            ): entry is {
              repoId: string
              status: RepoListItemStatus
              createdAt: Date
            } =>
              entry.createdAt !== null &&
              entry.createdAt instanceof Date &&
              (entry.status === 'pass' ||
                entry.status === 'fail' ||
                entry.status === 'skipped' ||
                entry.status === 'running' ||
                entry.status === 'error'),
          )
          .map((entry) => [
            entry.repoId,
            {
              status: entry.status,
              createdAt: entry.createdAt,
            },
          ]),
      )

      return {
        owner: {
          id: owner.id,
          slug: owner.login,
          name: owner.name ?? owner.login,
        },
        repos: repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          enabled: repo.enabled,
          isPrivate: repo.private,
          storyCount: storyCountByRepo.get(repo.id) ?? 0,
          lastRunStatus: latestRunStatusByRepo.get(repo.id)?.status ?? null,
          lastRunAt: latestRunStatusByRepo.get(repo.id)?.createdAt ?? null,
        })),
      }
    }),

  getBySlug: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .query(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { repo: null }
      }

      const repo = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name', 'defaultBranch', 'enabled'])
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { repo: null }
      }

      return {
        repo: {
          id: repo.id,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          enabled: repo.enabled,
        },
      }
    }),

  enableRepo: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

      // Check if repo exists
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        throw new Error(
          `Repository ${input.repoName} not found for owner ${input.orgSlug}`,
        )
      }

      // Check if already enabled
      if (repo.enabled) {
        return { enabled: true, repoId: repo.id }
      }

      // Enable the repo
      await ctx.db
        .updateTable('repos')
        .set({ enabled: true })
        .where('id', '=', repo.id)
        .execute()

      return { enabled: true, repoId: repo.id }
    }),

  disableRepo: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

      // Check if repo exists
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        throw new Error(
          `Repository ${input.repoName} not found for owner ${input.orgSlug}`,
        )
      }

      // Disable the repo
      await ctx.db
        .updateTable('repos')
        .set({ enabled: false })
        .where('id', '=', repo.id)
        .execute()

      return { enabled: false, repoId: repo.id }
    }),
})
