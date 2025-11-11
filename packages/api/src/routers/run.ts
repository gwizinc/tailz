import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { configure, tasks } from '@trigger.dev/sdk'

import type { RunStory, StoryAnalysisV1 } from '@app/db'
import { findRepoForUser, requireRepoForUser } from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'
import { parseEnv } from '../helpers/env'
import { fetchGithubFileSnippet } from '../actions/github/getters'

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

      const stories = fetchedStories.map((s) => ({
        id: s.id,
        name: s.name,
        story: s.story,
        branchName: s.branchName,
        commitSha: s.commitSha,
        createdAt: s.createdAt ?? new Date(),
        updatedAt: s.updatedAt ?? new Date(),
      }))

      // Create a map of story ID to story data
      const storyMap = new Map(stories.map((s) => [s.id, s]))

      // Type assertion needed until migration runs and types are regenerated
      type RunRow = {
        id: string
        commitSha: string
        branchName: string
        commitMessage: string | null
        prNumber: string | null
        status: 'pass' | 'fail' | 'skipped' | 'running' | 'error'
        summary: string | null
        createdAt: Date
        updatedAt: Date
        stories: RunStory[]
      }

      const runRow = run as unknown as RunRow

      const storyResults = await ctx.db
        .selectFrom('storyTestResults')
        .select((eb) => [
          'storyTestResults.id',
          'storyTestResults.storyId',
          'storyTestResults.status',
          'storyTestResults.analysisVersion',
          eb.cast('storyTestResults.analysis', 'jsonb').as('analysis'),
          'storyTestResults.startedAt',
          'storyTestResults.completedAt',
          'storyTestResults.durationMs',
          'storyTestResults.createdAt',
          'storyTestResults.updatedAt',
        ])
        .where('storyTestResults.runId', '=', runRow.id)
        .execute()

      const storyResultMap = new Map<
        string,
        {
          id: string
          storyId: string
          status: 'pass' | 'fail' | 'running' | 'error'
          analysisVersion: number
          analysis: StoryAnalysisV1 | null
          startedAt: string | null
          completedAt: string | null
          durationMs: number | null
          createdAt: string | null
          updatedAt: string | null
        }
      >(
        storyResults.map((result) => {
          const startedAt =
            result.startedAt instanceof Date
              ? result.startedAt.toISOString()
              : (result.startedAt ?? null)
          const completedAt =
            result.completedAt instanceof Date
              ? result.completedAt.toISOString()
              : (result.completedAt ?? null)
          const createdAt =
            result.createdAt instanceof Date
              ? result.createdAt.toISOString()
              : (result.createdAt ?? null)
          const updatedAt =
            result.updatedAt instanceof Date
              ? result.updatedAt.toISOString()
              : (result.updatedAt ?? null)

          const status = ['pass', 'fail', 'running', 'error'].includes(
            result.status,
          )
            ? (result.status as 'pass' | 'fail' | 'running' | 'error')
            : 'error'

          const analysis =
            result.analysis && typeof result.analysis === 'object'
              ? (result.analysis as StoryAnalysisV1)
              : null

          return [
            result.id,
            {
              id: result.id,
              storyId: result.storyId,
              status,
              analysisVersion: result.analysisVersion,
              analysis,
              startedAt,
              completedAt,
              durationMs: result.durationMs ?? null,
              createdAt,
              updatedAt,
            },
          ]
        }),
      )

      // Combine run stories with actual story and evaluation data

      const storiesWithStatus = run.stories.map((runStory) => {
        const story = storyMap.get(runStory.storyId)
        const result =
          runStory.resultId !== undefined && runStory.resultId !== null
            ? (storyResultMap.get(runStory.resultId) ?? null)
            : null

        return {
          storyId: runStory.storyId,
          status: runStory.status,
          resultId: runStory.resultId ?? null,
          summary: runStory.summary ?? null,
          startedAt: runStory.startedAt ?? null,
          completedAt: runStory.completedAt ?? null,
          story: story
            ? {
                id: story.id,
                name: story.name,
                story: story.story,
                branchName: story.branchName,
                commitSha: story.commitSha,
                createdAt: story.createdAt.toISOString(),
                updatedAt: story.updatedAt.toISOString(),
              }
            : null,
          result,
        }
      })

      return {
        run: {
          id: runRow.id,
          commitSha: runRow.commitSha,
          branchName: runRow.branchName,
          commitMessage: runRow.commitMessage,
          prNumber: runRow.prNumber,
          status: runRow.status,
          summary: runRow.summary,
          createdAt: runRow.createdAt.toISOString(),
          updatedAt: runRow.updatedAt.toISOString(),
          stories: storiesWithStatus,
        },
      }
    }),

  getEvidenceSource: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        commitSha: z.string(),
        filePath: z.string(),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
        contextLines: z.number().int().min(0).max(50).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

      try {
        const snippet = await fetchGithubFileSnippet({
          owner: input.orgSlug,
          repo: input.repoName,
          commitSha: input.commitSha,
          filePath: input.filePath,
          startLine: input.startLine ?? null,
          endLine: input.endLine ?? null,
          contextLines: input.contextLines,
        })

        return { snippet }
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to load related code from GitHub',
        })
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        branchName: z.string().optional(),
        agentVersion: z.enum(['v1', 'v2']).default('v1'),
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
