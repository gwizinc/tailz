import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const checkSuiteHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing check_suite event', { deliveryId })
  // TODO: Monitor check suite lifecycle events.
  return Promise.resolve()
}