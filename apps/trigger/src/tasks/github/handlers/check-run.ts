import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const checkRunHandler: WebhookHandler = ({ deliveryId }) => {
  logger.info('Processing check_run event', { deliveryId })
  // TODO: Monitor external check runs for context.
  return Promise.resolve()
}