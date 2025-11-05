import { z } from 'zod'

import { protectedProcedure, router } from '../trpc'

export const repoRouter = router({
  listByOrg: protectedProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner)
        return {
          repos: [] as Array<{
            id: string
            name: string
            defaultBranch: string | null
            enabled: boolean
          }>,
        }

      const repos = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name', 'defaultBranch', 'enabled'])
        .where('ownerId', '=', owner.id)
        .orderBy('name')
        .execute()

      return { repos }
    }),

  setEnabled: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) return { updated: 0 }

      await ctx.db
        .updateTable('repos')
        .set({ enabled: false })
        .where('ownerId', '=', owner.id)
        .execute()

      if (input.repoNames.length === 0) return { updated: 0 }

      await ctx.db
        .updateTable('repos')
        .set({ enabled: true })
        .where('ownerId', '=', owner.id)
        .where('name', 'in', input.repoNames)
        .execute()

      return { updated: input.repoNames.length }
    }),
})
