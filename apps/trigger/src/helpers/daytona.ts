import { Daytona } from '@daytonaio/sdk'
import { parseEnv } from '@app/config'
import { getOctokitClient } from './github'

type DaytonaClient = InstanceType<typeof Daytona>
type DaytonaSandbox = Awaited<ReturnType<DaytonaClient['create']>>

interface CreateSandboxParams {
  repoId: string
  /** Defaults to repo default branch */
  branchName?: string
  commit?: string
  additionalLabels?: Record<string, string>
}

export async function createDaytonaSandbox(
  params: CreateSandboxParams,
): Promise<DaytonaSandbox> {
  const { DAYTONA_API_KEY: apiKey } = parseEnv()
  const daytona = new Daytona({ apiKey })

  // Get GitHub token for cloning
  const {
    token: githubToken,
    repo: { ownerLogin, repoName },
  } = await getOctokitClient(params.repoId)

  const slug = `${ownerLogin}/${repoName}`

  // Construct repoUrl and repoPath
  const repoUrl = `https://github.com/${slug}.git`
  const repoPath = `workspace/repo`

  // Create the sandbox
  const sandbox = await daytona.create({
    ephemeral: true,
    autoArchiveInterval: 1, // 1 minute of no activity will kill the box
    language: 'typescript',
    labels: {
      'kyoto.repoId': params.repoId,
      'kyoto.slug': slug,
      ...params.additionalLabels,
    },
  })

  // Clone the repository
  await sandbox.git.clone(
    repoUrl,
    repoPath,
    params.branchName,
    params.commit,
    'x-access-token',
    githubToken,
  )

  // Clean up credentials
  await sandbox.process.executeCommand(
    'rm -f ~/.git-credentials ~/.config/gh/hosts.yml || true',
  )

  return sandbox
}
