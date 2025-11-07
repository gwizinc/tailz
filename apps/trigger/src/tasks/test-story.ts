import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'

import { parseEnv } from '../helpers/env'
import { normalizeStoryTestResult } from '../agents/story-evaluator'
import { runStoryEvaluationTask } from './run-story-evaluation'

interface TestStoryPayload {
  storyId: string
  runId?: string | null
}

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: TestStoryPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    // Kick off the evaluation run and capture the inputs being processed
    logger.info('Starting story evaluation', {
      storyId: payload.storyId,
      runId: payload.runId,
    })

    // Look up the story and associated repository metadata needed for testing
    const storyRecord = await db
      .selectFrom('stories')
      .innerJoin('repos', 'stories.repoId', 'repos.id')
      .select([
        'stories.id as storyId',
        'stories.name as storyName',
        'stories.story as storyText',
        'stories.repoId as repoId',
        'stories.commitSha as commitSha',
        'stories.branchName as branchName',
        'repos.name as repoName',
      ])
      .where('stories.id', '=', payload.storyId)
      .executeTakeFirst()

    if (!storyRecord) {
      throw new Error(`Story ${payload.storyId} not found`)
    }

    const startedAt = new Date()

    // Create an initial result row so downstream steps can stream updates
    const inserted = await db
      .insertInto('storyTestResults')
      .values({
        storyId: payload.storyId,
        runId: payload.runId ?? null,
        status: 'running',
        startedAt,
        analysisVersion: 1,
        analysis: null,
      })
      .returning(['id'])
      .executeTakeFirst()

    const resultId = inserted?.id

    if (!resultId) {
      throw new Error('Failed to create story test result record')
    }

    try {
      /**
       * 💎 Run Story Evaluation Agent
       */
      const evaluationRun = await runStoryEvaluationTask.triggerAndWait({
        storyName: storyRecord.storyName,
        storyText: storyRecord.storyText,
        repoId: storyRecord.repoId,
        repoName: storyRecord.repoName,
        branchName: storyRecord.branchName,
        commitSha: storyRecord.commitSha,
        runId: payload.runId ?? null,
        maxSteps: 6,
      })

      if (!evaluationRun.ok) {
        const errorMessage =
          evaluationRun.error instanceof Error
            ? evaluationRun.error.message
            : 'run-story-evaluation task failed'

        throw new Error(errorMessage)
      }

      const evaluation = evaluationRun.output

      logger.info('Story evaluation agent completed', {
        storyId: payload.storyId,
        runId: payload.runId,
        resultId,
        finishReason: evaluation.finishReason,
        agentSteps: evaluation.metrics.stepCount,
        contextToolCalls: evaluation.metrics.toolCallCount,
      })

      const modelOutput = evaluation.output

      /**
       * 💎 Normalize and Persist Story Test Result
       */
      const normalized = normalizeStoryTestResult(
        modelOutput,
        startedAt,
        new Date(),
      )

      const completedAt = normalized.completedAt
        ? new Date(normalized.completedAt)
        : null

      await db
        .updateTable('storyTestResults')
        .set((eb) => ({
          status: normalized.status,
          analysisVersion: normalized.analysisVersion,
          analysis:
            normalized.analysis !== null
              ? eb.cast(eb.val(JSON.stringify(normalized.analysis)), 'jsonb')
              : eb.val(null),
          completedAt,
          durationMs: normalized.durationMs,
        }))
        .where('id', '=', resultId)
        .execute()

      logger.info('Story evaluation completed', {
        storyId: payload.storyId,
        runId: payload.runId,
        status: normalized.status,
        resultId,
      })

      return {
        // Provide a succinct summary for orchestration tasks and UI consumption
        success: true,
        storyId: payload.storyId,
        runId: payload.runId ?? null,
        resultId,
        status: normalized.status,
        analysisVersion: normalized.analysisVersion,
        analysis: normalized.analysis,
      }
    } catch (error) {
      // Ensure the DB row reflects failure details before bubbling the error upward
      logger.error('Story evaluation failed', {
        storyId: payload.storyId,
        runId: payload.runId,
        resultId,
        error,
      })

      const failureDescription =
        error instanceof Error ? error.message : 'Unknown error occurred'

      const failureAnalysis = {
        version: 1,
        conclusion: 'fail',
        explanation: failureDescription,
        evidence: [],
      }

      await db
        .updateTable('storyTestResults')
        .set({
          status: 'fail',
          analysisVersion: 1,
          analysis: failureAnalysis,
          completedAt: new Date(),
        })
        .where('id', '=', resultId)
        .execute()

      throw error
    }
  },
})
