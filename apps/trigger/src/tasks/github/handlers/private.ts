import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const privateHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing private event', { deliveryId })
  // TODO: Handle repository visibility change to private.
  return Promise.resolve()
}