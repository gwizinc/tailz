import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const installationTargetsHandler: WebhookHandler = async ({
  deliveryId,
}) => {
  logger.info('Processing installation_targets event', { deliveryId })
  // TODO: Handle installation target add/remove events.
}

