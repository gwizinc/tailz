import { json } from '@app/db'
import type { RunStory } from '@app/db'
import type { AggregatedCounts } from '../../helpers/github-checks'
import type { DbClient, StoryRow } from './types'
import type { TestStoryTaskResult } from '../test-story'
import type { Status } from '@app/agents'

export interface AggregatedRunOutcome {
  aggregated: AggregatedCounts
  updatedRunStories: RunStory[]
  finalStatus: Status
  summaryText: string
  summaryParts: string[]
}

type TestStoryTaskTriggerResult =
  | {
      ok: true
      resultId: string
      taskIdentifier: string
      /** From the Trigger.dev task */
      output: TestStoryTaskResult
    }
  | {
      ok: false
      resultId: string
      taskIdentifier: string
      error: unknown
    }

export function aggregateBatchResults({
  batchResult,
  stories,
  initialRunStories,
}: {
  batchResult: TestStoryTaskTriggerResult[]
  stories: StoryRow[]
  initialRunStories: RunStory[]
}): AggregatedRunOutcome {
  const aggregated: AggregatedCounts = {
    pass: 0,
    fail: 0,
    error: 0,
  }
  const updatedRunStories: RunStory[] = []

  batchResult.forEach((result: TestStoryTaskTriggerResult, index) => {
    const story = stories[index]

    if (!story) {
      return
    }

    if (result.ok) {
      const output = result.output.evaluation

      if (output.status === 'pass') {
        aggregated.pass += 1
      } else if (output.status === 'fail') {
        aggregated.fail += 1
      } else if (output.status === 'error') {
        aggregated.error += 1
      }

      updatedRunStories.push({
        storyId: story.id,
        status: output.status,
        resultId: result.resultId,
        summary: null,
        startedAt: initialRunStories[index]?.startedAt ?? null,
        completedAt: new Date().toISOString(),
      })
    } else {
      aggregated.error += 1
      const errorMessage =
        result.error &&
        typeof result.error === 'object' &&
        'message' in result.error &&
        typeof (result.error as { message?: unknown }).message === 'string'
          ? ((result.error as { message: string }).message ??
            'Evaluation failed')
          : 'Evaluation failed'

      updatedRunStories.push({
        storyId: story.id,
        status: 'error',
        resultId: null,
        summary: errorMessage,
        startedAt: initialRunStories[index]?.startedAt ?? null,
        completedAt: new Date().toISOString(),
      })
    }
  })

  const totalStories = stories.length
  const finalStatus = determineFinalStatus(aggregated, totalStories)
  const summaryParts = buildSummaryParts(aggregated)
  const summaryText = summaryParts.join(', ')

  return {
    aggregated,
    updatedRunStories,
    finalStatus,
    summaryText,
    summaryParts,
  }
}

function determineFinalStatus(
  aggregated: AggregatedCounts,
  totalStories: number,
): Status {
  if (aggregated.error > 0) {
    return 'error'
  }

  if (aggregated.fail > 0) {
    return 'fail'
  }

  if (aggregated.pass === totalStories && totalStories > 0) {
    return 'pass'
  }

  return 'skipped'
}

function buildSummaryParts(aggregated: AggregatedCounts): string[] {
  return [
    `${aggregated.pass} passed`,
    `${aggregated.fail} failed`,
    `${aggregated.error} errors`,
  ]
}

export async function updateRunResults({
  db,
  runId,
  finalStatus,
  summaryText,
  updatedRunStories,
}: {
  db: DbClient
  runId: string
  finalStatus: Status
  summaryText: string
  updatedRunStories: RunStory[]
}): Promise<void> {
  await db
    .updateTable('runs')
    .set({
      status: finalStatus,
      summary: summaryText,
      stories: json(updatedRunStories),
    })
    .where('id', '=', runId)
    .execute()
}

export async function markRunFailure({
  db,
  runId,
  summary,
  status = 'fail',
}: {
  db: DbClient
  runId: string
  summary: string
  status?: 'fail' | 'error'
}): Promise<void> {
  await db
    .updateTable('runs')
    .set({
      status,
      summary,
    })
    .where('id', '=', runId)
    .execute()
}
