import { TRPCError } from '@trpc/server'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { Updateable } from 'kysely'

import type { Story } from '@app/db/types'
import {
  findRepoForUser,
  findStoryForUser,
  requireRepoForUser,
} from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'
import type { TestStatus } from '@app/schemas'

export const storyRouter = router({
  listByRepo: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await findRepoForUser(ctx.db, {
        orgName: input.orgName,
        repoName: input.repoName,
        userId,
      })

      if (!repo) {
        return { stories: [] }
      }

      const stories = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('repoId', '=', repo.id)
        .where('archived', '=', false)
        .orderBy('createdAt', 'desc')
        .execute()

      const storyIds = stories.map((story) => story.id)

      let latestStatuses = new Map<
        string,
        { status: TestStatus; createdAt: Date | null }
      >()

      if (storyIds.length > 0) {
        const statusRows = await ctx.db
          .selectFrom('storyTestResults')
          .select([
            'storyTestResults.storyId as storyId',
            'storyTestResults.status as status',
            'storyTestResults.createdAt as createdAt',
          ])
          .where('storyTestResults.storyId', 'in', storyIds)
          .where('storyTestResults.status', '!=', 'running')
          .orderBy('storyTestResults.storyId', 'asc')
          .orderBy('storyTestResults.createdAt', 'desc')
          .orderBy('storyTestResults.id', 'desc')
          .execute()

        latestStatuses = statusRows.reduce((acc, row) => {
          if (!acc.has(row.storyId)) {
            acc.set(row.storyId, {
              status: row.status as TestStatus,
              createdAt: row.createdAt ?? null,
            })
          }
          return acc
        }, new Map<string, { status: TestStatus; createdAt: Date | null }>())
      }

      return {
        stories: stories.map((story) => ({
          id: story.id,
          name: story.name,
          story: story.story,
          createdAt: story.createdAt?.toISOString() ?? null,
          updatedAt: story.updatedAt?.toISOString() ?? null,
          groups: [], // Files column removed - groups no longer derived from files
          latestStatus: latestStatuses.get(story.id)?.status ?? null,
          latestStatusAt:
            latestStatuses.get(story.id)?.createdAt?.toISOString() ?? null,
        })),
      }
    }),

  get: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
        storyId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await findRepoForUser(ctx.db, {
        orgName: input.orgName,
        repoName: input.repoName,
        userId,
      })

      if (!repo) {
        return { story: null }
      }

      // Query story
      const story = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!story) {
        return { story: null }
      }

      return { story }
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
        name: z
          .string()
          .optional()
          .default('')
          .describe('Generated if not provided.'),
        story: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgName: input.orgName,
        repoName: input.repoName,
        userId,
      })

      // Create story
      const newStory = await ctx.db
        .insertInto('stories')
        .values({
          repoId: repo.id,
          name: input.name,
          story: input.story,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Trigger story decomposition task
      await tasks.trigger('story-decomposition', {
        story: {
          id: newStory.id,
          text: newStory.story,
          title: input.name?.trim() || '',
        },
        repo: {
          id: repo.id,
          slug: `${input.orgName}/${input.repoName}`,
          branchName: repo.defaultBranch ?? undefined,
        },
      })

      return {
        story: newStory,
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
        storyId: z.string(),
        name: z.string().min(1).optional(),
        story: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgName: input.orgName,
        repoName: input.repoName,
        userId,
      })

      // Check if story exists and belongs to repo
      const existingStory = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!existingStory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Story ${input.storyId} not found`,
        })
      }

      // Build update object
      const updateData: Updateable<Story> = {}
      if (input.name !== undefined) {
        updateData.name = input.name
      }
      if (input.story !== undefined) {
        updateData.story = input.story
        updateData.decomposition = null
      }

      // Update story
      const updatedStory = await ctx.db
        .updateTable('stories')
        .set(updateData)
        .where('id', '=', input.storyId)
        .returningAll()
        .executeTakeFirstOrThrow()

      // Trigger story decomposition task if story text was updated
      if (input.story !== undefined) {
        await tasks.trigger('story-decomposition', {
          story: {
            id: updatedStory.id,
            text: updatedStory.story,
            title: input.name || updatedStory.name || '',
          },
          repo: {
            id: repo.id,
            slug: `${input.orgName}/${input.repoName}`,
            branchName: repo.defaultBranch ?? undefined,
          },
        })
      }

      return {
        story: updatedStory,
      }
    }),

  archive: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        repoName: z.string(),
        storyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgName: input.orgName,
        repoName: input.repoName,
        userId,
      })

      // Check if story exists and belongs to repo
      const existingStory = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!existingStory) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Story ${input.storyId} not found`,
        })
      }

      // Archive story (soft delete)
      await ctx.db
        .updateTable('stories')
        .set({ archived: true })
        .where('id', '=', input.storyId)
        .execute()

      return { success: true }
    }),

  test: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const storyWithRepo = await findStoryForUser(ctx.db, {
        storyId: input.storyId,
        userId,
      })

      if (!storyWithRepo) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Story not accessible',
        })
      }

      const runHandle = await tasks.trigger('test-story', {
        storyId: input.storyId,
        runId: null,
      })

      return {
        queued: true,
        runId: runHandle.id,
      }
    }),

  decompose: protectedProcedure
    .input(
      z.object({
        storyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const storyWithRepo = await findStoryForUser(ctx.db, {
        storyId: input.storyId,
        userId,
      })

      if (!storyWithRepo) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Story not accessible',
        })
      }

      // Get owner info for repo slug
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('id', '=', storyWithRepo.repo.ownerId)
        .executeTakeFirst()

      if (!owner) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Owner not found',
        })
      }

      const runHandle = await tasks.trigger('story-decomposition', {
        story: {
          id: storyWithRepo.story.id,
          text: storyWithRepo.story.story,
          title: storyWithRepo.story.name || '',
        },
        repo: {
          id: storyWithRepo.repo.id,
          slug: `${owner.login}/${storyWithRepo.repo.name}`,
        },
      })

      return {
        queued: true,
        runId: runHandle.id,
      }
    }),
})
