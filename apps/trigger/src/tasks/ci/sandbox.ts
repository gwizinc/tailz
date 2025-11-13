import pMap from 'p-map'
import type { RunStory } from '@app/db'
import { AGENT_CONFIG, type AgentVersion } from '@app/agents'
import type { RepoRecord, StoryRow } from './types'
import { aggregateBatchResults, type AggregatedRunOutcome } from './results'
import { testStoryTask } from '../test-story'
import { createDaytonaSandbox } from '../../helpers/daytona'

interface RunStoriesWithSandboxParams {
  repoRecord: RepoRecord
  repo: {
    repoName: string
    ownerLogin: string
  }
  branchName: string
  stories: StoryRow[]
  initialRunStories: RunStory[]
  runId: string
  agentVersion?: AgentVersion
}

export async function runStoriesWithSandbox({
  repoRecord,
  repo,
  branchName,
  stories,
  initialRunStories,
  runId,
  agentVersion = AGENT_CONFIG.version,
}: RunStoriesWithSandboxParams): Promise<AggregatedRunOutcome> {
  const sandbox = await createDaytonaSandbox({
    repoId: repoRecord.repoId,
    branchName,
    additionalLabels: {
      'kyoto.runId': runId,
    },
  })

  try {
    const batchResult = await pMap(
      stories,
      async (story) => {
        return await testStoryTask.triggerAndWait(
          {
            storyId: story.id,
            runId,
            daytonaSandboxId: sandbox.id,
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
      // ! can only be 1 - trigger.dev requirement
      { concurrency: 1 },
    )

    return aggregateBatchResults({
      batchResult,
      stories,
      initialRunStories,
    })
  } finally {
    await sandbox.delete()
  }
}
