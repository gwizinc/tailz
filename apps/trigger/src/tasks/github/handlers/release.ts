import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const releaseHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing release event', { deliveryId })
  // TODO: Handle release lifecycle events.
  return Promise.resolve()
}