import { logger, task } from '@trigger.dev/sdk'

import { branchProtectionRuleHandler } from './handlers/branch-protection-rule'
import { checkRunHandler } from './handlers/check-run'
import { checkSuiteHandler } from './handlers/check-suite'
import { createHandler } from './handlers/create'
import { deleteHandler } from './handlers/delete'
import { installationHandler } from './handlers/installation'
import { installationRepositoriesHandler } from './handlers/installation-repositories'
import { installationTargetsHandler } from './handlers/installation-targets'
import { metaHandler } from './handlers/meta'
import { privateHandler } from './handlers/private'
import { publicHandler } from './handlers/public'
import { pullRequestHandler } from './handlers/pull-request'
import { pushHandler } from './handlers/push'
import { releaseHandler } from './handlers/release'
import { repositoryHandler } from './handlers/repository'
import { repositoryVulnerabilityAlertHandler } from './handlers/repository-vulnerability-alert'
import { statusHandler } from './handlers/status'
import type { WebhookHandler } from './types'

const handlers: Record<string, WebhookHandler> = {
  push: pushHandler,
  pull_request: pullRequestHandler,
  installation: installationHandler,
  installation_repositories: installationRepositoriesHandler,
  repository: repositoryHandler,
  check_run: checkRunHandler,
  check_suite: checkSuiteHandler,
  status: statusHandler,
  branch_protection_rule: branchProtectionRuleHandler,
  create: createHandler,
  delete: deleteHandler,
  installation_targets: installationTargetsHandler,
  meta: metaHandler,
  public: publicHandler,
  private: privateHandler,
  repository_vulnerability_alert: repositoryVulnerabilityAlertHandler,
  release: releaseHandler,
}

export const handleGithubWebhookTask = task({
  id: 'handle-github-webhook',
  run: async (payload: {
    eventType: string
    deliveryId: string
    payload: unknown
  }) => {
    logger.info('Handling GitHub webhook', {
      eventType: payload.eventType,
      deliveryId: payload.deliveryId,
      payload: payload.payload,
    })

    const handler = handlers[payload.eventType]

    if (!handler) {
      logger.info('Unhandled webhook event type', {
        eventType: payload.eventType,
        deliveryId: payload.deliveryId,
      })
    } else {
      await handler({
        deliveryId: payload.deliveryId,
        rawPayload: payload.payload,
      })
    }

    return {
      success: true,
      eventType: payload.eventType,
      deliveryId: payload.deliveryId,
    }
  },
})

