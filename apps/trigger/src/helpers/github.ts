import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export function createInstallationOctokit(params: {
  appId: number
  privateKey: string
  installationId: number
}): Octokit {
  const { appId, privateKey, installationId } = params
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  })
}
