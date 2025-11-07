import { sql } from '@app/db'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { protectedProcedure, router } from '../trpc'

const defaultFeatures = [
  {
    title: 'MCP Support',
    description:
      'Have access to the index of your repo via an MCP service along with functionality to review stories and create new ones.',
  },
  {
    title: 'Browser Support',
    description:
      'Give our agents a browser to launch your app and test the code as if a real human, taking screenshots and videos along the way.',
  },
  {
    title: 'Rich Text Stories',
    description:
      'Your stories can come to life with rich text editing and images.',
  },
  {
    title: 'Story to Code',
    description: 'Write a story and let us make a PR to implement it.',
  },
  {
    title: 'Auto Fix PRs',
    description: 'We will create a PR to automatically fix the issue detected',
  },
  {
    title: 'Local CLI',
    description: 'A CLI tool to run tests locally on your machine.',
  },
] as const

const createFeatureSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
})

const voteSchema = z.object({
  featureId: z.string().uuid(),
})

export const featureRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ctx.db
      .insertInto('featureRequests')
      .values(
        defaultFeatures.map((feature) => ({
          title: feature.title,
          description: feature.description,
          createdBy: ctx.user.id,
        })),
      )
      .onConflict((oc) => oc.column('title').doNothing())
      .execute()

    const rows = await ctx.db
      .selectFrom('featureRequests as fr')
      .select((eb) => [
        'fr.id',
        'fr.title',
        'fr.description',
        'fr.voteCount',
        'fr.createdAt',
        'fr.updatedAt',
        eb
          .exists(
            eb
              .selectFrom('featureVotes as fv')
              .select('fv.id')
              .whereRef('fv.featureId', '=', 'fr.id')
              .where('fv.userId', '=', ctx.user.id),
          )
          .as('hasVoted'),
      ])
      .orderBy('fr.voteCount', 'desc')
      .orderBy('fr.createdAt', 'asc')
      .execute()

    return {
      features: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        voteCount: row.voteCount,
        hasVoted: Boolean(row.hasVoted),
        createdAt: (row.createdAt ?? new Date()).toISOString(),
        updatedAt: (row.updatedAt ?? new Date()).toISOString(),
      })),
    }
  }),

  create: protectedProcedure
    .input(createFeatureSchema)
    .mutation(async ({ ctx, input }) => {
      const [feature] = await ctx.db
        .insertInto('featureRequests')
        .values({
          title: input.title,
          description: input.description,
          createdBy: ctx.user.id,
        })
        .returningAll()
        .execute()

      return {
        feature: {
          id: feature.id,
          title: feature.title,
          description: feature.description,
          voteCount: feature.voteCount,
          hasVoted: false,
          createdAt: (feature.createdAt ?? new Date()).toISOString(),
          updatedAt: (feature.updatedAt ?? new Date()).toISOString(),
        },
      }
    }),

  vote: protectedProcedure
    .input(voteSchema)
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction().execute(async (trx) => {
        const feature = await trx
          .selectFrom('featureRequests')
          .select(['id'])
          .where('id', '=', input.featureId)
          .executeTakeFirst()

        if (!feature) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Feature not found',
          })
        }

        const existingVote = await trx
          .selectFrom('featureVotes')
          .select(['id'])
          .where('featureId', '=', input.featureId)
          .where('userId', '=', ctx.user.id)
          .executeTakeFirst()

        if (existingVote) {
          await trx
            .deleteFrom('featureVotes')
            .where('id', '=', existingVote.id)
            .execute()

          await trx
            .updateTable('featureRequests')
            .set({
              voteCount: sql<number>`GREATEST(vote_count - 1, 0)`,
            })
            .where('id', '=', input.featureId)
            .execute()
        } else {
          await trx
            .insertInto('featureVotes')
            .values({
              featureId: input.featureId,
              userId: ctx.user.id,
            })
            .onConflict((oc) => oc.columns(['featureId', 'userId']).doNothing())
            .execute()

          await trx
            .updateTable('featureRequests')
            .set({
              voteCount: sql<number>`vote_count + 1`,
            })
            .where('id', '=', input.featureId)
            .execute()
        }

        const updated = await trx
          .selectFrom('featureRequests as fr')
          .select((eb) => [
            'fr.id',
            'fr.voteCount',
            eb
              .exists(
                eb
                  .selectFrom('featureVotes as fv')
                  .select('fv.id')
                  .whereRef('fv.featureId', '=', 'fr.id')
                  .where('fv.userId', '=', ctx.user.id),
              )
              .as('hasVoted'),
          ])
          .where('fr.id', '=', input.featureId)
          .executeTakeFirst()

        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Feature not found',
          })
        }

        return {
          feature: {
            id: updated.id,
            voteCount: updated.voteCount,
            hasVoted: Boolean(updated.hasVoted),
          },
        }
      })
    }),
})
