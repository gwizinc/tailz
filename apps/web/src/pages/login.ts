import type { APIRoute } from 'astro'
import { z } from 'zod'

import { auth } from '@/server/auth'

const querySchema = z.object({
  redirect: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) =>
        value == null || (value.startsWith('/') && !value.startsWith('//')),
      { message: 'redirect must be a relative path' },
    ),
})

export const GET: APIRoute = async ({ request }) => {
  const searchParams = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = querySchema.safeParse(searchParams)

  const callbackURL =
    parsed.success && parsed.data.redirect != null ? parsed.data.redirect : '/'

  const result = await auth.api.signInSocial({
    body: {
      provider: 'github',
      callbackURL,
      disableRedirect: true,
    },
    headers: request.headers,
  })

  if (typeof result === 'object' && result != null) {
    if ('url' in result) {
      const url = result.url
      if (typeof url === 'string' && url.length > 0) {
        return Response.redirect(url, 302)
      }
    }

    if (
      'redirect' in result &&
      result.redirect === false &&
      'token' in result
    ) {
      const destination = new URL(callbackURL, request.url)
      return Response.redirect(destination.toString(), 302)
    }
  }

  return new Response(null, { status: 500 })
}
