import type { APIRoute } from 'astro'
import { configure, tasks } from '@trigger.dev/sdk'
import { z } from 'zod'
import { env } from '@/server/env'

const githubAppCallbackQuerySchema = z.object({
  installation_id: z.coerce.number(),
  setup_action: z.enum(['install', 'update']).optional(),
  state: z.string().optional(),
})

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url)
  const parsed = githubAppCallbackQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  )
  if (!parsed.success) {
    return new Response('Invalid callback query', { status: 400 })
  }

  const { installation_id } = parsed.data

  try {
    configure({
      secretKey: env.triggerSecretKey,
    })

    await tasks.trigger('sync-github-installation', {
      installationId: installation_id,
    })
  } catch (error) {
    console.error('Failed to trigger GitHub installation sync:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined
    return new Response(
      `Failed to sync installation${errorDetails ? `: ${errorDetails}` : ''}`,
      { status: 500 },
    )
  }

  return redirect('/app')
}
