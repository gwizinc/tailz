import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'
import { setupDb } from '@app/db'
import { parseEnv } from './env'

export function createOctokit(installationId: number): Octokit {
  const env = parseEnv()
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      installationId,
    },
  })
}

interface RepoWithOctokit {
  repo: {
    repoName: string
    ownerLogin: string
    installationId: number
  }
  octokit: Octokit
}

export async function getRepoWithOctokit(
  repoId: string,
): Promise<RepoWithOctokit> {
  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  const repo = await db
    .selectFrom('repos')
    .innerJoin('owners', 'repos.ownerId', 'owners.id')
    .select([
      'repos.name as repoName',
      'owners.login as ownerLogin',
      'owners.installationId',
    ])
    .where('repos.id', '=', repoId)
    .executeTakeFirst()

  if (!repo || !repo.installationId) {
    throw new Error('Repository or installation not found or misconfigured')
  }

  const octokit = createOctokit(Number(repo.installationId))

  return {
    repo: {
      repoName: repo.repoName,
      ownerLogin: repo.ownerLogin,
      installationId: Number(repo.installationId),
    },
    octokit,
  }
}
