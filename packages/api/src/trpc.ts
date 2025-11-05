import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import type { Context } from './context'

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

// Middleware for logging
const loggingMiddleware = t.middleware(async ({ next, type, path }) => {
  const result = await next()

  if (!result.ok) {
    console.error(`Error calling ${type} ${path}:`, result.error)
  }

  return result
})

// Middleware to check if the user is authenticated
const authMiddleware = t.middleware(({ ctx, next }) => {
  // Check if the session and user exist (using the placeholder Session type)
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  // Pass down the context, now including a guaranteed non-null user
  return next({
    ctx: {
      ...ctx,
      // Infers session and user are non-null now based on the check above
      session: ctx.session,
      user: ctx.user,
    },
  })
})

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure.use(loggingMiddleware)
export const protectedProcedure = publicProcedure.use(authMiddleware)
