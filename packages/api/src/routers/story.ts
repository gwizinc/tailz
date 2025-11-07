import { configure, tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { Updateable } from 'kysely'

import type { Json, Story } from '@app/db/types'
import { protectedProcedure, router } from '../trpc'
import { parseEnv } from '../helpers/env'

export const storyRouter = router({
  listByBranch: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        branchName: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { stories: [] }
      }

      // Look up repo
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { stories: [] }
      }

      // Query stories for this repo and branch
      const stories = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('repoId', '=', repo.id)
        .where('branchName', '=', input.branchName)
        .orderBy('createdAt', 'desc')
        .execute()

      return {
        stories: stories.map((story) => ({
          id: story.id,
          name: story.name,
          story: story.story,
          commitSha: story.commitSha,
          branchName: story.branchName,
          createdAt: story.createdAt?.toISOString() ?? null,
          updatedAt: story.updatedAt?.toISOString() ?? null,
        })),
      }
    }),

  get: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        storyId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { story: null, filesTouched: [] }
      }

      // Look up repo
      const repo = await ctx.db
        .selectFrom('repos')
        .selectAll()
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { story: null, filesTouched: [] }
      }

      // Query story
      const story = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!story) {
        return { story: null, filesTouched: [] }
      }

      // TODO: Implement file fetching based on files array
      return {
        story: {
          id: story.id,
          name: story.name,
          story: story.story,
          commitSha: story.commitSha,
          branchName: story.branchName,
          createdAt: story.createdAt?.toISOString() ?? null,
          updatedAt: story.updatedAt?.toISOString() ?? null,
        },
        filesTouched: [],
      }
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        branchName: z.string(),
        commitSha: z.string().nullable(),
        name: z.string().min(1),
        story: z.string().min(1),
        files: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

      // Look up repo
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

      // Create story
      const newStory = await ctx.db
        .insertInto('stories')
        .values({
          repoId: repo.id,
          branchName: input.branchName,
          commitSha: input.commitSha,
          name: input.name,
          story: input.story,
          files: input.files as unknown as Json,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      return {
        story: {
          id: newStory.id,
          name: newStory.name,
          story: newStory.story,
          commitSha: newStory.commitSha,
          branchName: newStory.branchName,
          createdAt: newStory.createdAt?.toISOString() ?? null,
          updatedAt: newStory.updatedAt?.toISOString() ?? null,
        },
      }
    }),

  update: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        storyId: z.string(),
        name: z.string().min(1).optional(),
        story: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

      // Look up repo
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

      // Check if story exists and belongs to repo
      const existingStory = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!existingStory) {
        throw new Error(`Story ${input.storyId} not found`)
      }

      // Build update object
      const updateData: Updateable<Story> = {}
      if (input.name !== undefined) {
        updateData.name = input.name
      }
      if (input.story !== undefined) {
        updateData.story = input.story
      }

      // Update story
      const updatedStory = await ctx.db
        .updateTable('stories')
        .set(updateData)
        .where('id', '=', input.storyId)
        .returningAll()
        .executeTakeFirstOrThrow()

      return {
        story: {
          id: updatedStory.id,
          name: updatedStory.name,
          story: updatedStory.story,
          commitSha: updatedStory.commitSha,
          branchName: updatedStory.branchName,
          createdAt: updatedStory.createdAt?.toISOString() ?? null,
          updatedAt: updatedStory.updatedAt?.toISOString() ?? null,
        },
      }
    }),

  delete: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        storyId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Look up owner
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

      // Look up repo
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

      // Check if story exists and belongs to repo
      const existingStory = await ctx.db
        .selectFrom('stories')
        .selectAll()
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!existingStory) {
        throw new Error(`Story ${input.storyId} not found`)
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
      const env = parseEnv(ctx.env)

      configure({
        secretKey: env.TRIGGER_SECRET_KEY,
      })

      const runHandle = await tasks.trigger('test-story', {
        storyId: input.storyId,
        runId: null,
      })

      return {
        queued: true,
        runId: runHandle.id,
      }
    }),
})
