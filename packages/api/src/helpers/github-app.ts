import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

interface GithubAppAuthOptions {
  appId: number
  privateKey: string
}

export async function listGithubAppInstallations({
  appId,
  privateKey,
}: GithubAppAuthOptions) {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
    },
  })

  return await octokit.paginate(octokit.apps.listInstallations, {
    per_page: 100,
  })
}
