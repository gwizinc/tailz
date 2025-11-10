import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const repositoryHandler: WebhookHandler = async ({ deliveryId }) => {
  logger.info('Processing repository event', { deliveryId })
  // TODO: Handle repository lifecycle events (created, deleted, archived, unarchived, renamed, edited).
}

