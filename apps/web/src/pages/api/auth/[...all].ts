import type { APIRoute } from 'astro'

import { auth } from '@/server/auth'

export const ALL: APIRoute = async (ctx) => {
  // If you want to use rate limiting, make sure to set the 'x-forwarded-for' header to the request headers from the context
  // ctx.request.headers.set("x-forwarded-for", ctx.clientAddress);
  return await auth.handler(ctx.request)
}
