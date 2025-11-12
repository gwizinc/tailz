import type { APIRoute } from 'astro'
import { z } from 'zod'

const bodySchema = z.object({
  kind: z.literal('backend'),
})

export const POST: APIRoute = async ({ request }) => {
  const body = bodySchema.parse(await request.json())

  if (body.kind === 'backend') {
    throw new Error('Sentry backend dev test error')
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
