import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { findRepoForUser } from '../helpers/memberships'
import { protectedProcedure, router } from '../trpc'

export const branchRouter = router({
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
        return { branches: [] }
      }

      const branches = [
        {
          name: 'main',
          headSha: 'abcdef1',
          updatedAt: new Date().toISOString(),
        },
        {
          name: 'feature/ai-gherkin',
          headSha: 'abcdef2',
          updatedAt: new Date().toISOString(),
        },
      ]
      return { branches }
    }),
})
