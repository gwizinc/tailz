import { defineMiddleware } from 'astro:middleware'

import { auth } from './server/auth'

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  const sessionData = await auth.api.getSession({
    headers: context.request.headers,
  })

  context.locals.userId = sessionData?.user?.id

  return await next()
})
