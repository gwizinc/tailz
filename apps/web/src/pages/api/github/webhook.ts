import type { APIRoute } from 'astro'
import { tasks } from '@trigger.dev/sdk'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/server/env'
import z from 'zod'

// Supported GitHub webhook event types that have handlers
const supportedEventTypes = new Set([
  'push',
  'pull_request',
  'installation',
  'installation_repositories',
  'installation_targets',
])

/**
 * Verifies the GitHub webhook signature using HMAC SHA256.
 * GitHub sends the signature in the X-Hub-Signature-256 header.
 *
 * @param payload - The raw request body as a string
 * @param signature - The signature from the X-Hub-Signature-256 header
 * @param secret - The webhook secret
 * @returns true if the signature is valid, false otherwise
 */
function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  // GitHub sends signature as "sha256=<hash>"
  const expectedSignature = `sha256=${createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`

  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false
  }

  // Convert strings to Buffers for timing-safe comparison
  const signatureBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

  return timingSafeEqual(signatureBuffer, expectedBuffer)
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Get the raw body as text for signature verification
    const rawBody = await request.text()

    // Get the signature from headers
    const signature = request.headers.get('X-Hub-Signature-256')
    if (!signature) {
      return new Response('Missing X-Hub-Signature-256 header', { status: 401 })
    }

    // Verify the webhook signature
    const isValid = verifyGitHubSignature(
      rawBody,
      signature,
      env.githubWebhookSecret,
    )

    if (!isValid) {
      return new Response('Invalid webhook signature', { status: 401 })
    }

    // Parse the JSON payload
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch (_error) {
      return new Response('Invalid JSON payload', { status: 400 })
    }

    // Get the event type from headers
    const eventType = request.headers.get('X-GitHub-Event')
    if (!eventType) {
      return new Response('Missing X-GitHub-Event header', { status: 400 })
    }

    // Get the delivery ID for logging
    const deliveryId = request.headers.get('X-GitHub-Delivery') || 'unknown'

    // Skip triggering task for unsupported event types
    if (!supportedEventTypes.has(eventType)) {
      return new Response('Webhook received (event type not handled)', {
        status: 200,
      })
    }

    const parsed = z
      .object({
        repository: z.object({
          full_name: z.string(),
        }),
      })
      .safeParse(payload)
    const ownerLogin = parsed.success
      ? parsed.data.repository.full_name.split('/')[0]
      : null
    const repoName = parsed.success
      ? parsed.data.repository.full_name.split('/')[1]
      : null

    // Trigger the task to handle the webhook
    await tasks.trigger(
      'handle-github-webhook',
      {
        eventType,
        deliveryId,
        payload,
      },
      {
        tags: [
          `gh_${deliveryId}`,
          ...(ownerLogin ? [`owner_${ownerLogin}`] : []),
          ...(repoName ? [`repo_${repoName}`] : []),
        ],
      },
    )

    return new Response('Webhook received', { status: 200 })
  } catch (error) {
    console.error('Failed to process GitHub webhook:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = import.meta.env.DEV ? errorMessage : undefined
    return new Response(
      `Failed to process webhook${errorDetails ? `: ${errorDetails}` : ''}`,
      { status: 500 },
    )
  }
}
