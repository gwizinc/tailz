import { z } from 'zod'

import type { RunStory } from '@app/db'
import { protectedProcedure, router } from '../trpc'

export const runRouter = router({
  listByRepo: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .query(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { runs: [] }
      }

      // Look up repo
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { runs: [] }
      }

      // Query runs for this repo
      // Note: runs table types will be generated after migration runs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const dbRuns = await (ctx.db as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .selectFrom('runs')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .selectAll()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .where('repoId', '=', repo.id)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .orderBy('createdAt', 'desc')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .execute()

      // Map database runs to frontend format
      // Map status: 'pass' -> 'success', 'fail' -> 'failed', 'skipped' -> 'skipped'
      const statusMap: Record<
        string,
        'queued' | 'running' | 'success' | 'failed' | 'skipped'
      > = {
        pass: 'success',
        fail: 'failed',
        skipped: 'skipped',
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const runs = dbRuns.map((run: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const createdAt = run.createdAt as Date
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          createdAt: createdAt.toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          updatedAt: updatedAt.toISOString(),
          durationMs,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          commitSha: run.commitSha,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          commitMessage: run.commitMessage ?? null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          branchName: run.branchName,
        }
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { run: null }
      }

      // Look up repo
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { run: null }
      }

      // Look up run by repo_id and number (not UUID)
      // Note: runs table types will be generated after migration runs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const run = await (ctx.db as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .selectFrom('runs')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .selectAll()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .where('repoId', '=', repo.id)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .where('number', '=', runNumber)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .executeTakeFirst()

      if (!run) {
        return { run: null }
      }

      // Extract story IDs from the stories JSONB
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const storyIds = (run.stories as RunStory[]).map((s) => s.storyId)

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

      // Combine run stories with actual story data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const storiesWithStatus = (run.stories as RunStory[]).map((runStory) => {
        const story = storyMap.get(runStory.storyId)
        return {
          storyId: runStory.storyId,
          status: runStory.status,
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
        }
      })

      // Type assertion needed until migration runs and types are regenerated
      type RunRow = {
        id: string
        commitSha: string
        branchName: string
        commitMessage: string | null
        prNumber: string | null
        status: 'pass' | 'fail' | 'skipped'
        summary: string | null
        createdAt: Date
        updatedAt: Date
        stories: RunStory[]
      }

      const runRow = run as unknown as RunRow

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
})
