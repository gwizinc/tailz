import { TRPCError } from '@trpc/server'
import { configure, tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import type { Updateable } from 'kysely'

import type { Json, Story } from '@app/db/types'
import {
  findRepoForUser,
  findStoryForUser,
  requireRepoForUser,
} from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'
import { parseEnv } from '../helpers/env'

type StoryTestStatus = 'pass' | 'fail' | 'error' | 'running'

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_ENRICH_MODEL = 'gpt-4o-mini'

const openAiChatCompletionSchema = z
  .object({
    choices: z
      .array(
        z.object({
          message: z.object({
            content: z.string(),
          }),
        }),
      )
      .min(1),
  })
  .passthrough()

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
        orgSlug: z.string(),
        repoName: z.string(),
      }),
    )
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
          commitSha: story.commitSha,
          branchName: story.branchName,
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
        orgSlug: z.string(),
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
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

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
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

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
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
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

  enrich: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        storyId: z.string(),
        story: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const env = parseEnv(ctx.env)

      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
        repoName: input.repoName,
        userId,
      })

      const existingStory = await ctx.db
        .selectFrom('stories')
        .select(['story'])
        .where('id', '=', input.storyId)
        .where('repoId', '=', repo.id)
        .executeTakeFirst()

      if (!existingStory && !input.story) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Story ${input.storyId} not found`,
        })
      }

      const baseStory = input.story ?? existingStory?.story ?? ''
      const trimmedStory = baseStory.trim()

      if (trimmedStory.length === 0) {
        throw new Error('Story content is empty, cannot enrich')
      }

      // TODO add the story format here, the type of story it is
      const userPrompt = [
        'Enrich the following user story with more detail while preserving intent, keeping the output in the same format.',
        'Return only the enriched story text.',
        '',
        trimmedStory,
      ].join('\n')

      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_ENRICH_MODEL,
          messages: [
            {
              role: 'system',
              content: `
              You are a senior QA software engineer specializing in user story writing.
              You are given a user story and you need to enrich it with more detail while preserving intent, keeping the output in the same format.
              
              # Important
              - You must preserve the intent from the original story. Do not add extra details.
              - Focus more on spell checking, grammar, structure, organization, and formatting.
              - Write the story in gherkin-style, plain text
              - You will return only the enriched story text.
              `,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `Failed to enrich story via OpenAI: ${response.status} ${errorText}`,
        )
      }

      const parsed = openAiChatCompletionSchema.parse(await response.json())

      const enrichedStory = parsed.choices[0]?.message.content?.trim()

      if (!enrichedStory) {
        throw new Error('OpenAI response did not include enriched content')
      }

      return {
        enrichedStory,
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
      const userId = ctx.user?.id

      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const repo = await requireRepoForUser(ctx.db, {
        orgSlug: input.orgSlug,
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
