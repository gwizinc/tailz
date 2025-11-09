import { json } from '@app/db'
import type { RunStory, StoryAnalysisV1 } from '@app/db'
import type { AggregatedCounts } from '../../helpers/github-checks'
import type { DbClient, StoryRow } from './types'
import type { BatchTriggerResult } from './sandbox'

export interface AggregatedRunOutcome {
  aggregated: AggregatedCounts
  updatedRunStories: RunStory[]
  finalStatus: 'pass' | 'fail' | 'skipped'
  summaryText: string
  summaryParts: string[]
}

export function aggregateBatchResults({
  batchResult,
  stories,
  initialRunStories,
}: {
  batchResult: BatchTriggerResult
  stories: StoryRow[]
  initialRunStories: RunStory[]
}): AggregatedRunOutcome {
  const aggregated: AggregatedCounts = {
    pass: 0,
    fail: 0,
    blocked: 0,
  }
  const updatedRunStories: RunStory[] = []

  batchResult.runs.forEach((result, index) => {
    const story = stories[index]

    if (!story) {
      return
    }

    if (result.ok) {
      const output = result.output as {
        resultId: string
        status: 'pass' | 'fail' | 'blocked' | 'running'
        analysisVersion: number
        analysis: StoryAnalysisV1 | null
      }

      if (output.status === 'pass') {
        aggregated.pass += 1
      } else if (output.status === 'fail') {
        aggregated.fail += 1
      } else if (output.status === 'blocked') {
        aggregated.blocked += 1
      }

      updatedRunStories.push({
        storyId: story.id,
        status: output.status,
        resultId: output.resultId,
        summary: null,
        startedAt: initialRunStories[index]?.startedAt ?? null,
        completedAt: new Date().toISOString(),
      })
    } else {
      aggregated.fail += 1
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
        status: 'fail',
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

export function determineFinalStatus(
  aggregated: AggregatedCounts,
  totalStories: number,
): 'pass' | 'fail' | 'skipped' {
  if (aggregated.fail > 0 || aggregated.blocked > 0) {
    return 'fail'
  }

  if (aggregated.pass === totalStories && totalStories > 0) {
    return 'pass'
  }

  return 'skipped'
}

export function buildSummaryParts(aggregated: AggregatedCounts): string[] {
  return [
    `${aggregated.pass} passed`,
    `${aggregated.fail} failed`,
    `${aggregated.blocked} blocked`,
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
  finalStatus: 'pass' | 'fail' | 'skipped'
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
}: {
  db: DbClient
  runId: string
  summary: string
}): Promise<void> {
  await db
    .updateTable('runs')
    .set({
      status: 'fail',
      summary,
    })
    .where('id', '=', runId)
    .execute()
}
