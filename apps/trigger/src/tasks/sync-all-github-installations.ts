import { task, logger } from '@trigger.dev/sdk'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { parseEnv } from '@app/config'
import { syncGithubInstallationTask } from './sync-github-installation'

function createAppLevelOctokit(): Octokit {
  const env = parseEnv()
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    },
  })
}

export const syncAllGithubInstallationsTask = task({
  id: 'sync-all-github-installations',
  run: async () => {
    const octokit = createAppLevelOctokit()

    const installations = await octokit.paginate(
      octokit.rest.apps.listInstallations,
      { per_page: 100 },
    )

    logger.info('Discovered GitHub App installations', {
      count: installations.length,
    })

    await syncGithubInstallationTask.batchTrigger(
      installations.map((i) => ({
        payload: {
          installationId: String(i.id),
        },
      })),
    )

    return {
      success: true,
      queued: installations.length,
    }
  },
})
