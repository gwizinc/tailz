import { router, protectedProcedure } from '../trpc'

export const orgRouter = router({
  getDefault: protectedProcedure.query(() => {
    return {
      org: {
        id: 'demo-org',
        slug: 'demo-org',
        name: 'Demo Org',
      },
    }
  }),
  listInstalled: protectedProcedure.query(async ({ ctx }) => {
    const owners = await ctx.db
      .selectFrom('owners')
      .select(['login as slug', 'name'])
      .where('installationId', 'is not', null)
      .orderBy('login')
      .execute()

    return { orgs: owners.map((o) => ({ slug: o.slug, name: o.name ?? o.slug })) }
  }),
  getSetupStatus: protectedProcedure.query(async ({ ctx }) => {
    const installed = await ctx.db
      .selectFrom('owners')
      .select(['id'])
      .where('installationId', 'is not', null)
      .executeTakeFirst()

    if (!installed) return { hasInstallation: false, hasEnabledRepos: false }

    const enabledRepo = await ctx.db
      .selectFrom('repos')
      .select(['id'])
      .where('enabled', '=', true)
      .executeTakeFirst()

    return { hasInstallation: true, hasEnabledRepos: Boolean(enabledRepo) }
  }),
})
