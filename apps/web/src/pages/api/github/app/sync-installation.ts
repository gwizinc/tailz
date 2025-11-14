import type { APIRoute } from 'astro'
import { tasks } from '@trigger.dev/sdk'
import { z } from 'zod'

const syncInstallationQuerySchema = z.object({
  installation_id: z.coerce.number(),
})

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const parsed = syncInstallationQuerySchema.parse(body)

    const { installation_id } = parsed

    // Trigger the background task to sync the installation
    const handle = await tasks.trigger(
      'sync-github-installation',
      {
        installationId: installation_id,
      },
      { priority: 60 },
    )

    return new Response(
      JSON.stringify({
        success: true,
        triggerHandle: {
          publicAccessToken: handle.publicAccessToken,
          id: handle.id,
        },
        installationId: installation_id,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Failed to trigger sync GitHub installation task:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined

    return new Response(
      JSON.stringify({
        success: false,
        error: `Failed to trigger sync installation${errorDetails ? `: ${errorDetails}` : ''}`,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
