import { logger } from '@trigger.dev/sdk'

import { statusEventSchema } from '../shared/schemas'
import type { WebhookHandler } from '../types'

export const statusHandler: WebhookHandler = ({
  deliveryId,
  rawPayload,
}) => {
  const parsed = statusEventSchema.safeParse(rawPayload)

  if (!parsed.success) {
    logger.error('Failed to parse status event payload', {
      deliveryId,
      issues: parsed.error.issues,
    })
    return Promise.resolve()
  }

  const { context, target_url: targetUrl } = parsed.data
  const isVercelContext = context.toLowerCase().includes('vercel')
  const isVercelTarget =
    typeof targetUrl === 'string' && targetUrl.toLowerCase().includes('vercel.app')

  if (isVercelContext || isVercelTarget) {
    logger.info('Vercel deployment status detected', {
      deliveryId,
      targetUrl: targetUrl ?? null,
      state: parsed.data.state,
      sha: parsed.data.sha,
    })
  }

  return Promise.resolve()
}
