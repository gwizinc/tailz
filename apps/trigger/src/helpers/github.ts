import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { setupDb } from '@app/db'
import { parseEnv } from '@app/config'

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

async function getRepoWithOctokit(repoId: string): Promise<RepoWithOctokit> {
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

interface OctokitClient extends RepoWithOctokit {
  token: string
}

export async function getOctokitClient(repoId: string): Promise<OctokitClient> {
  const { repo, octokit } = await getRepoWithOctokit(repoId)
  const authResult = await octokit.auth({ type: 'installation' })

  const token =
    typeof authResult === 'string'
      ? authResult
      : authResult && typeof authResult === 'object' && 'token' in authResult
        ? (authResult.token as string | undefined)
        : undefined

  if (!token) {
    throw new Error('Failed to generate GitHub installation token')
  }

  return {
    repo,
    octokit,
    token,
  }
}

export interface GitAuthor {
  id: number | string | null
  login: string | null
  name: string | null
}

interface BranchDetails {
  commitSha: string
  commitMessage: string
  gitAuthor: GitAuthor | null
}

async function getGithubCommitAuthor(
  octokit: Octokit,
  params: {
    owner: string
    repo: string
    commitSha: string
  },
): Promise<GitAuthor | null> {
  try {
    const commitData = await octokit.rest.repos.getCommit({
      owner: params.owner,
      repo: params.repo,
      ref: params.commitSha,
    })

    const author = commitData.data.author
    const commit = commitData.data.commit

    if (!author) {
      // If author is not available, try to get from commit author info
      const commitAuthor = commit?.author
      if (commitAuthor?.name) {
        return {
          id: null,
          login: null,
          name: commitAuthor.name,
        }
      }
      return null
    }

    return {
      id: author.id ?? null,
      login: author.login ?? null,
      name: author.name ?? commit?.author?.name ?? null,
    }
  } catch (_error) {
    return null
  }
}

export async function getGithubBranchDetails(
  octokit: Octokit,
  params: {
    owner: string
    repo: string
    branch: string
  },
): Promise<BranchDetails> {
  const branchData = await octokit.rest.repos.getBranch({
    owner: params.owner,
    repo: params.repo,
    branch: params.branch,
  })

  const commitSha = branchData.data.commit?.sha ?? null
  const commitMessage = branchData.data.commit?.commit?.message ?? null

  let gitAuthor: GitAuthor | null = null
  if (commitSha) {
    gitAuthor = await getGithubCommitAuthor(octokit, {
      owner: params.owner,
      repo: params.repo,
      commitSha,
    })
  }

  return {
    commitSha,
    commitMessage,
    gitAuthor,
  }
}
