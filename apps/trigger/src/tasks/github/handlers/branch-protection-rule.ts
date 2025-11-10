import { logger } from '@trigger.dev/sdk'

import type { WebhookHandler } from '../types'

export const branchProtectionRuleHandler: WebhookHandler = async ({
  deliveryId,
}) => {
  logger.info('Processing branch_protection_rule event', { deliveryId })
  // TODO: Track branch protection rule changes.
}

