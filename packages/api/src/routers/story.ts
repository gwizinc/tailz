import { TRPCError } from '@trpc/server'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { Updateable } from 'kysely'

import type { Json, Story } from '@app/db/types'
import {
  findRepoForUser,
  findStoryForUser,
  requireRepoForUser,
} from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'

type StoryTestStatus = 'pass' | 'fail' | 'error' | 'running'

function deriveGroupNamesFromFiles(files: Json | null): string[] {
  if (!files || !Array.isArray(files)) {
    return []
  }

  const groupNames = new Set<string>()

  for (const entry of files) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      continue
    }

    const [rawPath] = entry.split('@', 1)
    if (!rawPath) {
      continue
    }

    const sanitizedPath = rawPath.trim().replace(/\\/g, '/')
    const segments = sanitizedPath.split('/').filter(Boolean)
    if (segments.length === 0) {
      continue
    }

    let group = segments[0]
    if (
      (segments[0] === 'apps' ||
        segments[0] === 'packages' ||
        segments[0] === 'services') &&
      segments.length >= 2
    ) {
      group = `${segments[0]}/${segments[1]}`
    } else if (segments[0] === 'src' && segments.length >= 2) {
      group = `${segments[0]}/${segments[1]}`
    }

    groupNames.add(group)
  }

  return Array.from(groupNames)
}

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
        .orderBy('createdAt', 'desc')
        .execute()

      const storyIds = stories.map((story) => story.id)

      let latestStatuses = new Map<
        string,
        { status: StoryTestStatus; createdAt: Date | null }
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
              status: row.status as StoryTestStatus,
              createdAt: row.createdAt ?? null,
            })
          }
          return acc
        }, new Map<string, { status: StoryTestStatus; createdAt: Date | null }>())
      }

      return {
        stories: stories.map((story) => ({
          id: story.id,
          name: story.name,
          story: story.story,
          createdAt: story.createdAt?.toISOString() ?? null,
          updatedAt: story.updatedAt?.toISOString() ?? null,
          groups: deriveGroupNamesFromFiles(story.files as Json),
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
        name: z.string().min(1),
        story: z.string().min(1),
        files: z.array(z.string()).default([]),
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
          files: input.files as unknown as Json,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      // Trigger story decomposition task
      await tasks.trigger('story-decomposition', {
        story: {
          id: newStory.id,
          text: newStory.story,
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

  delete: protectedProcedure
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

      // Delete story
      await ctx.db
        .deleteFrom('stories')
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
