import { z } from 'zod'

import { configure, tasks } from '@trigger.dev/sdk'
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

      // Trigger story discovery for newly enabled repos (fire-and-forget)
      if (
        newlyEnabledRepoIds.length > 0 &&
        ctx.env.githubAppId &&
        ctx.env.githubAppPrivateKey &&
        ctx.env.openRouterApiKey &&
        ctx.env.databaseUrl
      ) {
        const appId = Number(ctx.env.githubAppId)
        if (!Number.isNaN(appId)) {
          // Trigger story discovery tasks asynchronously without blocking the response
          Promise.all(
            newlyEnabledRepoIds.map((repoId) =>
              tasks
                .trigger('find-stories-in-repo', {
                  repoId,
                  appId,
                  privateKey: ctx.env.githubAppPrivateKey,
                  openRouterApiKey: ctx.env.openRouterApiKey,
                  databaseUrl: ctx.env.databaseUrl,
                })
                .catch((error) => {
                  console.error(
                    `Failed to trigger story discovery for repository ${repoId}:`,
                    error,
                  )
                }),
            ),
          ).catch((error) => {
            console.error('Error triggering story discovery:', error)
          })
        }
      }

      return { updated: input.repoNames.length }
    }),

  findStoriesInRepo: protectedProcedure
    .input(z.object({ orgSlug: z.string(), repoName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.env.githubAppId || !ctx.env.githubAppPrivateKey) {
        throw new Error('GitHub App configuration is missing')
      }

      if (!ctx.env.openRouterApiKey) {
        throw new Error('OpenRouter API key is missing')
      }

      if (!ctx.env.triggerSecretKey) {
        throw new Error('TRIGGER_SECRET_KEY environment variable is not set')
      }

      const appId = Number(ctx.env.githubAppId)
      if (Number.isNaN(appId)) {
        throw new TypeError('Invalid GitHub App ID')
      }

      // Configure trigger
      configure({
        secretKey: ctx.env.triggerSecretKey,
      })

      // Look up owner and repo to get repoId
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

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

      // Trigger the task
      await tasks.trigger('find-stories-in-repo', {
        repoId: repo.id,
        appId,
        privateKey: ctx.env.githubAppPrivateKey,
        openRouterApiKey: ctx.env.openRouterApiKey,
        databaseUrl: ctx.env.databaseUrl,
      })

      return { success: true }
    }),

  findStoriesInCommit: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        commitSha: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.env.githubAppId || !ctx.env.githubAppPrivateKey) {
        throw new Error('GitHub App configuration is missing')
      }

      if (!ctx.env.openRouterApiKey) {
        throw new Error('OpenRouter API key is missing')
      }

      if (!ctx.env.triggerSecretKey) {
        throw new Error('TRIGGER_SECRET_KEY environment variable is not set')
      }

      const appId = Number(ctx.env.githubAppId)
      if (Number.isNaN(appId)) {
        throw new TypeError('Invalid GitHub App ID')
      }

      // Configure trigger
      configure({
        secretKey: ctx.env.triggerSecretKey,
      })

      // Look up owner and repo to get repoId
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

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

      // Trigger the task
      await tasks.trigger('find-stories-in-commit', {
        repoId: repo.id,
        appId,
        privateKey: ctx.env.githubAppPrivateKey,
        openRouterApiKey: ctx.env.openRouterApiKey,
        databaseUrl: ctx.env.databaseUrl,
        commitSha: input.commitSha,
      })

      return { success: true }
    }),

  findStoriesInPullRequest: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        repoName: z.string(),
        pullNumber: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.env.githubAppId || !ctx.env.githubAppPrivateKey) {
        throw new Error('GitHub App configuration is missing')
      }

      if (!ctx.env.openRouterApiKey) {
        throw new Error('OpenRouter API key is missing')
      }

      if (!ctx.env.triggerSecretKey) {
        throw new Error('TRIGGER_SECRET_KEY environment variable is not set')
      }

      const appId = Number(ctx.env.githubAppId)
      if (Number.isNaN(appId)) {
        throw new TypeError('Invalid GitHub App ID')
      }

      // Configure trigger
      configure({
        secretKey: ctx.env.triggerSecretKey,
      })

      // Look up owner and repo to get repoId
      const owner = await ctx.db
        .selectFrom('owners')
        .selectAll()
        .where('login', '=', input.orgSlug)
        .executeTakeFirst()

      if (!owner) {
        throw new Error(`Owner with slug ${input.orgSlug} not found`)
      }

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

      // Trigger the task
      await tasks.trigger('find-stories-in-pull-request', {
        repoId: repo.id,
        appId,
        privateKey: ctx.env.githubAppPrivateKey,
        openRouterApiKey: ctx.env.openRouterApiKey,
        databaseUrl: ctx.env.databaseUrl,
        pullNumber: input.pullNumber,
      })

      return { success: true }
    }),
})
