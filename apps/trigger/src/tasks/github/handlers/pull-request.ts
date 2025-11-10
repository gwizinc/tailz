import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const pullRequestHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing pull_request event', { deliveryId })
  // TODO: Handle pull request lifecycle events (opened, synchronize, closed, reopened).
}

