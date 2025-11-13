import { logger } from '@trigger.dev/sdk'
import type { RunStory } from '@app/db'
import {
  buildCheckRunContent,
  formatStoryCount,
  submitCheckRun,
  type AggregatedCounts,
  type CheckRunBaseParams,
} from '../../helpers/github-checks'
import type { RepoRecord } from './types'
import type { Status } from '@app/agents'

export function buildCheckRunBase({
  commitSha,
  octokit,
  repoRecord,
  runId,
  runNumber,
  branchName,
  detailsUrl,
}: {
  commitSha: string | null
  octokit: CheckRunBaseParams['octokit']
  repoRecord: RepoRecord
  runId: string
  runNumber: number
  branchName: string
  detailsUrl: string | null
}): CheckRunBaseParams | null {
  if (!commitSha) {
    return null
  }

  return {
    octokit,
    owner: repoRecord.ownerLogin,
    repo: repoRecord.repoName,
    headSha: commitSha,
    runId,
    runNumber,
    branchName,
    detailsUrl,
  }
}

export async function startCheckRun({
  checkRunBase,
  storiesCount,
  repoId,
  branchName,
  runId,
}: {
  checkRunBase: CheckRunBaseParams | null
  storiesCount: number
  repoId: string
  branchName: string
  runId: string
}): Promise<number | undefined> {
  if (!checkRunBase) {
    logger.warn(
      'Skipping GitHub check run creation due to missing commit SHA',
      {
        repoId,
        branchName,
      },
    )
    return undefined
  }

  const startContent = buildCheckRunContent({
    phase: 'start',
    runNumber: checkRunBase.runNumber,
    runId,
    branchName,
    summary:
      storiesCount === 0
        ? 'No stories available for evaluation'
        : `Evaluating ${formatStoryCount(storiesCount)}`,
    storyCount: storiesCount,
  })

  try {
    return await submitCheckRun({
      ...checkRunBase,
      content: startContent,
    })
  } catch (error) {
    logger.warn('Failed to create initial GitHub check run', {
      runId,
      error,
    })
    return undefined
  }
}

export async function completeCheckRunSuccess({
  checkRunBase,
  checkRunId,
  runId,
  branchName,
  status,
  summary,
  counts,
}: {
  checkRunBase: CheckRunBaseParams | null
  checkRunId?: number
  runId: string
  branchName: string
  status: Status
  summary: string
  counts: AggregatedCounts
}): Promise<void> {
  if (!checkRunBase) {
    return
  }

  const completionContent = buildCheckRunContent({
    phase: 'complete',
    runNumber: checkRunBase.runNumber,
    runId,
    branchName,
    status,
    summary,
    counts,
  })

  await submitCheckRun({
    ...checkRunBase,
    content: completionContent,
    existingCheckRunId: checkRunId,
  })
}

export async function completeCheckRunFailure({
  checkRunBase,
  checkRunId,
  runId,
  branchName,
  summary,
  status = 'fail',
}: {
  checkRunBase: CheckRunBaseParams | null
  checkRunId?: number
  runId: string
  branchName: string
  summary: string
  status?: 'fail' | 'error'
}): Promise<void> {
  if (!checkRunBase) {
    return
  }

  const failureContent = buildCheckRunContent({
    phase: 'complete',
    runNumber: checkRunBase.runNumber,
    runId,
    branchName,
    status,
    summary,
  })

  await submitCheckRun({
    ...checkRunBase,
    content: failureContent,
    existingCheckRunId: checkRunId,
  })
}

export async function endBecauseNoStoriesExist({
  checkRunBase,
  checkRunId,
  runId,
  runNumber,
  branchName,
}: {
  checkRunBase: CheckRunBaseParams | null
  checkRunId?: number
  runId: string
  runNumber: number
  branchName: string
}): Promise<{
  success: true
  runId: string
  runNumber: number
  status: 'skipped'
  summary: string
  stories: RunStory[]
}> {
  const summaryText = 'No stories available for evaluation'
  const emptyStories: RunStory[] = []

  if (checkRunBase) {
    const completionContent = buildCheckRunContent({
      phase: 'complete',
      runNumber: checkRunBase.runNumber,
      runId,
      branchName,
      status: 'skipped',
      summary: summaryText,
    })

    await submitCheckRun({
      ...checkRunBase,
      content: completionContent,
      existingCheckRunId: checkRunId,
    })
  }

  return {
    success: true,
    runId,
    runNumber,
    status: 'skipped',
    summary: summaryText,
    stories: emptyStories,
  }
}
