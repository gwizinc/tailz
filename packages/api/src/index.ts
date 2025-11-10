import { userRouter } from './routers/user'
import { router } from './trpc'
import { orgRouter } from './routers/org'
import { repoRouter } from './routers/repo'
import { branchRouter } from './routers/branch'
import { storyRouter } from './routers/story'
import { runRouter } from './routers/run'
import { testRouter } from './routers/test'
import { featureRouter } from './routers/feature'

export type { Context, Env, Session, SessionUser } from './context'

export { getUser } from './helpers/users'

export const appRouter = router({
  user: userRouter,
  org: orgRouter,
  repo: repoRouter,
  branch: branchRouter,
  story: storyRouter,
  run: runRouter,
  test: testRouter,
  feature: featureRouter,
})

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter
