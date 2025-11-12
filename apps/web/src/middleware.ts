import * as Sentry from '@sentry/astro'
import { defineMiddleware } from 'astro:middleware'

import { auth } from './server/auth'

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  const sessionData = await auth.api.getSession({
    headers: context.request.headers,
  })

  const sessionUser = sessionData?.user

  context.locals.userId = sessionUser?.id ?? undefined

  if (sessionUser?.id) {
    Sentry.setUser({
      id: sessionUser.id,
      email: sessionUser.email ?? undefined,
      username: sessionUser.name ?? undefined,
    })
  } else {
    Sentry.setUser(null)
  }

  try {
    return await next()
  } finally {
    Sentry.setUser(null)
  }
})
