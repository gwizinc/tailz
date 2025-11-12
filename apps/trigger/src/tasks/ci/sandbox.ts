import { Daytona } from '@daytonaio/sdk'
import pMap from 'p-map'
import { logger } from '@trigger.dev/sdk'
import type { RunStory } from '@app/db'
import type { RepoRecord, StoryRow } from './types'
import { aggregateBatchResults, type AggregatedRunOutcome } from './results'
import { testStoryTask } from '../test-story'

type DaytonaClient = InstanceType<typeof Daytona>
type DaytonaSandbox = Awaited<ReturnType<DaytonaClient['create']>>

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
  agentVersion?: 'v1' | 'v2'
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
  agentVersion = 'v1',
}: RunStoriesWithSandboxParams): Promise<AggregatedRunOutcome> {
  const daytona = new Daytona({
    apiKey: daytonaApiKey,
  })
  const repoUrl = `https://github.com/${repo.ownerLogin}/${repo.repoName}.git`
  const repoPath = `workspace/${repo.repoName}`

  let sandbox: DaytonaSandbox | null = null

  try {
    sandbox = await daytona.create({
      ephemeral: true,
      autoArchiveInterval: 1, // 1 minute of no activity will kill the box
      labels: {
        'kyoto.repoId': repoRecord.repoId,
        'kyoto.slug': `${repo.ownerLogin}/${repo.repoName}`,
        'kyoto.runId': runId,
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

    const batchResult = await pMap(
      stories,
      async (story) => {
        return await testStoryTask.triggerAndWait(
          {
            storyId: story.id,
            runId,
            // TODO fix this na here
            daytonaSandboxId: sandbox?.id ?? 'na',
            agentVersion,
          },
          {
            tags: [
              `org_${repo.ownerLogin}`,
              `repo_${repo.repoName}`,
              `agent_${agentVersion}`,
            ],
            metadata: {
              name: story.name,
              story: story.story,
            },
          },
        )
      },
      { concurrency: 1 },
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
