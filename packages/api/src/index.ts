import { userRouter } from './routers/user'
import { router } from './trpc'

export type { Context, Env, Session, SessionUser } from './context'

export { getUser } from './actions/users/getters'

export const appRouter = router({
  user: userRouter,
})

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter
