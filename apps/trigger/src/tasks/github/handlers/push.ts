import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const pushHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing push event', { deliveryId })
  // TODO: Trigger story discovery and test runs on new commits.
}

