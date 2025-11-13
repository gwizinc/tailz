import { initTRPC, TRPCError } from '@trpc/server'
import { configure } from '@trigger.dev/sdk'
import superjson from 'superjson'

import type { Context } from './context'
import { parseEnv } from './helpers/env'

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
})

// Ensure Trigger.dev is configured once per process
let isTriggerConfigured = false

// Middleware to ensure Trigger.dev is configured
const triggerMiddleware = t.middleware(({ ctx, next }) => {
  if (!isTriggerConfigured) {
    const parsedEnv = parseEnv(ctx.env)
    configure({
      secretKey: parsedEnv.TRIGGER_SECRET_KEY,
    })
    isTriggerConfigured = true
  }
  return next()
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
const publicProcedure = t.procedure
  .use(triggerMiddleware)
  .use(loggingMiddleware)
export const protectedProcedure = publicProcedure.use(authMiddleware)
