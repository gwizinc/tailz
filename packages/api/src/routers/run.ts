import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { configure, tasks } from '@trigger.dev/sdk'

import { findRepoForUser, requireRepoForUser } from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'
import { parseEnv } from '../helpers/env'

export const runRouter = router({
  listByRepo: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await findRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

      if (!repo) {
        return { runs: [] }
      }

      // Query runs for this repo
      // Note: runs table types will be generated after migration runs
      const dbRuns = await ctx.db
        .selectFrom('runs')
        .selectAll()
        .where('repoId', '=', repo.id)
        .orderBy('createdAt', 'desc')
        .execute()

      // Map database runs to frontend format
      // Map status: 'pass' -> 'success', 'fail' -> 'failed', 'skipped' -> 'skipped', 'running' -> 'running'
      const statusMap: Record<
        string,
        'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'error'
      > = {
        pass: 'success',
        fail: 'failed',
        skipped: 'skipped',
        running: 'running',
        error: 'error',
      }

      const runs = dbRuns.map((run: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const createdAt = run.createdAt as Date
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const updatedAt = run.updatedAt as Date
        // Calculate duration in milliseconds
        const durationMs = updatedAt.getTime() - createdAt.getTime()

        return {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          id: run.id,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          runId: String(run.number),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          status: statusMap[run.status] ?? 'queued',

          createdAt: createdAt.toISOString(),

          updatedAt: updatedAt.toISOString(),
          durationMs,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          commitSha: run.commitSha ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          commitMessage: run.commitMessage ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          branchName: run.branchName,
        }
      })

      return { runs }
    }),

  getByRunId: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        runId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Parse runId as number (should be numeric like "101")
      const runNumber = Number.parseInt(input.runId, 10)
      if (Number.isNaN(runNumber) || runNumber < 1) {
        return { run: null }
      }

      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await findRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

      if (!repo) {
        return { run: null }
      }

      // Look up run by repo_id and number (not UUID)
      // Note: runs table types will be generated after migration runs
      const run = await ctx.db
        .selectFrom('runs')
        .selectAll()
        .where('repoId', '=', repo.id)
        .where('number', '=', runNumber)
        .executeTakeFirst()

      if (!run) {
        return { run: null }
      }

      // Extract story IDs from the stories JSONB
      const storyIds = run.stories.map((s) => s.storyId)

      // Fetch stories if there are any
      const fetchedStories =
        storyIds.length > 0
          ? await ctx.db
              .selectFrom('stories')
              .selectAll()
              .where('id', 'in', storyIds)
              .execute()
          : []

      const storyResults = await ctx.db
        .selectFrom('storyTestResults')
        .select([
          'storyTestResults.id',
          'storyTestResults.storyId',
          'storyTestResults.status',
          'storyTestResults.analysisVersion',
          'storyTestResults.analysis',
          'storyTestResults.startedAt',
          'storyTestResults.completedAt',
          'storyTestResults.durationMs',
          'storyTestResults.createdAt',
          'storyTestResults.updatedAt',
        ])
        .where('storyTestResults.runId', '=', run.id)
        .execute()

      return {
        run,
        stories: fetchedStories,
        storyResults,
      }
    }),

  /**
   * Starts a new CI run for a given repo, optionally on a specific branch.
   *
   * This endpoint will:
   * 1. Check user authentication (must be authorized for the repo).
   * 2. Confirm the user has access to the given org/repo.
   * 3. Configure the Trigger.dev client using environment secrets.
   * 4. Enqueue a "run-ci" task with TRIGGER.dev, including the org slug, repo name,
   *    branch name (if provided), and the requested agent version.
   * 5. Return `{ success: true }` on success.
   */
  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        branchName: z.string().optional(),
        agentVersion: z.enum(['v1', 'v2']).default('v2'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

      const env = parseEnv(ctx.env)

      configure({
        secretKey: env.TRIGGER_SECRET_KEY,
      })

      await tasks.trigger(
        'run-ci',
        {
          orgSlug: input.orgSlug,
          repoName: input.repoName,
          branchName: input.branchName,
          agentVersion: input.agentVersion,
        },
        { tags: [`org_${input.orgSlug}`, `repo_${input.repoName}`] },
      )

      return {
        success: true,
      }
    }),
})
