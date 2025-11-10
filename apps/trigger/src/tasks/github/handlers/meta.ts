import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const metaHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing meta event', { deliveryId })
  // TODO: Handle repository deletion hook cleanup.
  return Promise.resolve()
}