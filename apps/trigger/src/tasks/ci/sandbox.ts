import { Daytona } from '@daytonaio/sdk'
import { logger, tasks } from '@trigger.dev/sdk'
import type { RunStory } from '@app/db'
import type { RepoRecord, StoryRow } from './types'
import { aggregateBatchResults, type AggregatedRunOutcome } from './results'

type DaytonaClient = InstanceType<typeof Daytona>
type DaytonaSandbox = Awaited<ReturnType<DaytonaClient['create']>>
export type BatchTriggerResult = Awaited<
  ReturnType<typeof tasks.batchTriggerAndWait>
>

interface RunStoriesWithSandboxParams {
  daytonaApiKey: string
  repoRecord: RepoRecord
  repo: {
    repoName: string
    ownerLogin: string
  }
  branchName: string
  githubToken: string
  stories: StoryRow[]
  initialRunStories: RunStory[]
  runId: string
}

export async function runStoriesWithSandbox({
  daytonaApiKey,
  repoRecord,
  repo,
  branchName,
  githubToken,
  stories,
  initialRunStories,
  runId,
}: RunStoriesWithSandboxParams): Promise<AggregatedRunOutcome> {
  const daytona = new Daytona({
    apiKey: daytonaApiKey,
  })
  const repoUrl = `https://github.com/${repo.ownerLogin}/${repo.repoName}.git`
  const repoPath = `workspace/${repo.repoName}`

  let sandbox: DaytonaSandbox | null = null

  try {
    sandbox = await daytona.create({
      language: 'typescript',
      labels: {
        'tailz.repoId': repoRecord.repoId,
        'tailz.repo': `${repo.ownerLogin}/${repo.repoName}`,
        'tailz.runId': runId,
      },
    })

    logger.info(`🏎️ Daytona sandbox created`, {
      runId,
      sandboxId: sandbox.id,
      repo,
    })

    await sandbox.git.clone(
      repoUrl,
      repoPath,
      branchName,
      undefined,
      'x-access-token',
      githubToken,
    )

    await sandbox.process.executeCommand(
      'rm -f ~/.git-credentials ~/.config/gh/hosts.yml || true',
    )

    const batchResult = await tasks.batchTriggerAndWait(
      'test-story',
      stories.map((story) => ({
        payload: {
          storyId: story.id,
          runId,
          daytonaSandboxId: sandbox?.id,
        },
      })),
    )

    return aggregateBatchResults({
      batchResult,
      stories,
      initialRunStories,
    })
  } finally {
    if (sandbox) {
      await cleanupSandbox({
        sandbox,
        runId,
      })
    }
  }
}

async function cleanupSandbox({
  sandbox,
  runId,
}: {
  sandbox: DaytonaSandbox
  runId: string
}): Promise<void> {
  const sandboxId = sandbox.id
  try {
    await sandbox.delete()
    logger.info('🏎️ Stopped Daytona sandbox', {
      runId,
      sandboxId,
    })
  } catch (error) {
    logger.error('🏎️ Failed to stop Daytona sandbox', {
      runId,
      sandboxId,
      error,
    })
  }
}

