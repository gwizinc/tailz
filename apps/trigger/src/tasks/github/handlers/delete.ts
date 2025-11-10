import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const deleteHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing delete event', { deliveryId })
  // TODO: Handle branch or tag deletion events.
}

