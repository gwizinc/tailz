import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const publicHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing public event', { deliveryId })
  // TODO: Handle repository visibility change to public.
}

