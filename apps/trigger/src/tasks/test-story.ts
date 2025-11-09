import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'

import {
  parseEnv,
  normalizeStoryTestResult,
  runStoryEvaluationAgent,
} from '@app/agents'

interface TestStoryPayload {
  storyId: string
  /** The CI Run UUID */
  runId: string
  /** The Daytona Sandbox ID */
  daytonaSandboxId: string
  // TODO support if daytonaSandboxId is null so we can create a new sandbox for this single story execution
}

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: TestStoryPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

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
      const evaluation = await runStoryEvaluationAgent({
        ...storyRecord,
        runId: payload.runId,
        daytonaSandboxId: payload.daytonaSandboxId,
        maxSteps: 30,
      })

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
        evaluation,
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
        conclusion: 'error',
        explanation: failureDescription,
        evidence: [],
      }

      await db
        .updateTable('storyTestResults')
        .set({
          status: 'error',
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
