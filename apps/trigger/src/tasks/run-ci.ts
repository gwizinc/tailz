import { logger, tasks, task } from '@trigger.dev/sdk'

import { json, setupDb, sql } from '@app/db'
import type { RunStory, StoryAnalysisV1 } from '@app/db'

import { parseEnv } from '../helpers/env'

interface RunCiPayload {
  orgSlug: string
  repoName: string
  branchName?: string | null
}

type StoryRow = {
  id: string
  name: string
  story: string
  branchName: string
}

export const runCiTask = task({
  id: 'run-ci',
  run: async (payload: RunCiPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    /**
     * 💎 Get Repo Data
     */
    const repoRecord = await db
      .selectFrom('repos')
      .innerJoin('owners', 'repos.ownerId', 'owners.id')
      .select([
        'repos.id as repoId',
        'repos.defaultBranch as defaultBranch',
        'repos.name as repoName',
        'owners.login as ownerLogin',
      ])
      .where('owners.login', '=', payload.orgSlug)
      .where('repos.name', '=', payload.repoName)
      .executeTakeFirst()

    if (!repoRecord) {
      throw new Error(
        `Repository ${payload.orgSlug}/${payload.repoName} not found in database`,
      )
    }

    // TODO change to repo default in the future
    const branchName = payload.branchName?.trim() || 'main'

    /**
     * 💎 Get Stories
     */
    const storiesQuery = db
      .selectFrom('stories')
      .select(['id', 'name', 'story', 'branchName'])
      .where('repoId', '=', repoRecord.repoId)
      .where('branchName', '=', branchName)

    const stories = (await storiesQuery.execute()) as StoryRow[]

    const initialRunStories: RunStory[] = stories.map((story) => ({
      storyId: story.id,
      status: 'running',
      resultId: null,
      startedAt: new Date().toISOString(),
      summary: null,
      completedAt: null,
    }))

    const runStatus = stories.length === 0 ? 'skipped' : 'running'
    const runSummary =
      stories.length === 0 ? 'No stories available for evaluation' : null

    /**
     * 💎 Create Run Record
     */
    const insertedRun = await sql<{ id: string; number: number }>`
      INSERT INTO public.runs (
        repo_id,
        branch_name,
        status,
        stories,
        commit_sha,
        commit_message,
        pr_number,
        summary
      ) VALUES (
        ${repoRecord.repoId},
        ${branchName},
        ${runStatus},
        ${JSON.stringify(initialRunStories)}::jsonb,
        NULL,
        NULL,
        NULL,
        ${runSummary}
      )
      RETURNING id, number
    `.execute(db)

    const runInsert = insertedRun.rows[0]

    if (!runInsert) {
      throw new Error('Failed to create run record')
    }

    const runId = runInsert.id

    logger.info('Created run record', {
      runId,
      repoId: repoRecord.repoId,
      branchName,
      storyCount: stories.length,
    })

    if (stories.length === 0) {
      return {
        success: true,
        runId,
        runNumber: runInsert.number,
        status: 'skipped',
        summary: 'No stories available for evaluation',
        stories: [],
      }
    }

    /**
     * 💎 Run all stories in parallel
     */
    const batchResult = await tasks.batchTriggerAndWait(
      'test-story',
      stories.map((story) => ({
        payload: {
          storyId: story.id,
          runId,
        },
      })),
    )

    const updatedRunStories: RunStory[] = []

    const aggregated = {
      pass: 0,
      fail: 0,
      blocked: 0,
    }

    /**
     * 💎 Aggregate Results
     */
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
          // TODO use AI to summarize complete findings later.
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
    const summaryParts = [
      `${aggregated.pass} passed`,
      `${aggregated.fail} failed`,
      `${aggregated.blocked} blocked`,
    ]

    let finalStatus: 'pass' | 'fail' | 'skipped'
    if (aggregated.fail > 0 || aggregated.blocked > 0) {
      finalStatus = 'fail'
    } else if (aggregated.pass === totalStories) {
      finalStatus = 'pass'
    } else {
      finalStatus = 'skipped'
    }

    /**
     * 💎 Update Run Record
     */
    await db
      .updateTable('runs')
      .set({
        status: finalStatus,
        summary: summaryParts.join(', '),
        stories: json(updatedRunStories),
      })
      .where('id', '=', runId)
      .execute()

    logger.info('Completed run evaluation', {
      runId,
      finalStatus,
    })

    /**
     * 💎 Return Results
     */
    return {
      success: true,
      runId,
      runNumber: runInsert.number,
      status: finalStatus,
      summary: summaryParts.join(', '),
      stories: updatedRunStories,
    }
  },
})
