import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const createHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing create event', { deliveryId })
  // TODO: Handle branch or tag creation events.
}

