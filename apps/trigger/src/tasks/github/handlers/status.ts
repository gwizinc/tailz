import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const statusHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing status event', { deliveryId })
  // TODO: Track commit status updates from external systems.
  return Promise.resolve()
}