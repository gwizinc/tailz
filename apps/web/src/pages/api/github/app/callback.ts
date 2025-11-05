import type { APIRoute } from 'astro'
import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
} from 'astro:env/server'
import { githubAppCallbackQuerySchema, syncGithubInstallation } from '@app/api'
import { db } from '@/server/db'

export const GET: APIRoute = async ({ request, redirect }) => {
  const url = new URL(request.url)
  const parsed = githubAppCallbackQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  )
  if (!parsed.success) {
    return new Response('Invalid callback query', { status: 400 })
  }

  const { installation_id } = parsed.data

  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    console.error('Missing GitHub App environment variables')
    return new Response(
      'GitHub App configuration is missing. Please set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.',
      { status: 500 },
    )
  }

  const appId = Number(GITHUB_APP_ID)
  if (isNaN(appId)) {
    console.error('GITHUB_APP_ID is not a valid number:', GITHUB_APP_ID)
    return new Response('Invalid GITHUB_APP_ID configuration', { status: 500 })
  }

  try {
    await syncGithubInstallation({
      db,
      appId,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      installationId: installation_id,
    })
  } catch (error) {
    console.error('Failed to sync GitHub installation:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined
    return new Response(
      `Failed to sync installation${errorDetails ? `: ${errorDetails}` : ''}`,
      { status: 500 },
    )
  }

  return redirect('/setup/repos')
}
