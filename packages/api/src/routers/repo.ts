import { z } from 'zod'

import { analyzeRepository } from '../actions/repo/analyze'
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

      if (!owner) {
        return {
          repos: [] as Array<{
            id: string
            name: string
            defaultBranch: string | null
            enabled: boolean
          }>,
        }
      }

      const repos = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name', 'defaultBranch', 'enabled'])
        .where('ownerId', '=', owner.id)
        .orderBy('name')
        .execute()

      return { repos }
    }),

  getBySlug: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .query(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { repo: null }
      }

      const repo = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name', 'defaultBranch', 'enabled'])
        .where('ownerId', '=', owner.id)
        .where('name', '=', input.repoName)
        .executeTakeFirst()

      if (!repo) {
        return { repo: null }
      }

      return {
        repo: {
          id: repo.id,
          name: repo.name,
          defaultBranch: repo.defaultBranch,
          enabled: repo.enabled,
        },
      }
    }),

  setEnabled: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoNames: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        return { updated: 0 }
      }

      // Get currently enabled repos before update
      const previouslyEnabled = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name'])
        .where('ownerId', '=', owner.id)
        .where('enabled', '=', true)
        .execute()

      await ctx.db
        .updateTable('repos')
        .set({ enabled: false })
        .where('ownerId', '=', owner.id)
        .execute()

      if (input.repoNames.length === 0) {
        return { updated: 0 }
      }

      await ctx.db
        .updateTable('repos')
        .set({ enabled: true })
        .where('ownerId', '=', owner.id)
        .where('name', 'in', input.repoNames)
        .execute()

      // Get newly enabled repos (repos that are now enabled but weren't before)
      const newlyEnabled = await ctx.db
        .selectFrom('repos')
        .select(['id', 'name'])
        .where('ownerId', '=', owner.id)
        .where('name', 'in', input.repoNames)
        .where('enabled', '=', true)
        .execute()

      const previouslyEnabledNames = new Set(
        previouslyEnabled.map((r) => r.name),
      )
      const newlyEnabledRepoIds = newlyEnabled
        .filter((r) => !previouslyEnabledNames.has(r.name))
        .map((r) => r.id)

      // Trigger analysis for newly enabled repos (fire-and-forget)
      if (
        newlyEnabledRepoIds.length > 0 &&
        ctx.env.githubAppId &&
        ctx.env.githubAppPrivateKey &&
        ctx.env.openRouterApiKey
      ) {
        const appId = Number(ctx.env.githubAppId)
        if (!Number.isNaN(appId)) {
          // Run analysis asynchronously without blocking the response
          Promise.all(
            newlyEnabledRepoIds.map((repoId) =>
              analyzeRepository({
                db: ctx.db,
                repoId,
                appId,
                privateKey: ctx.env.githubAppPrivateKey!,
                openRouterApiKey: ctx.env.openRouterApiKey!,
              }).catch((error) => {
                console.error(`Failed to analyze repository ${repoId}:`, error)
              }),
            ),
          ).catch((error) => {
            console.error('Error in repository analysis:', error)
          })
        }
      }

      return { updated: input.repoNames.length }
    }),
})
