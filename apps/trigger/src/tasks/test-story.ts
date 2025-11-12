import { task, logger } from '@trigger.dev/sdk'

import { setupDb, type StoryTestResultPayload } from '@app/db'

import {
  parseEnv,
  normalizeStoryTestResult,
  runStoryEvaluationAgent,
  normalizeStoryTestResultV2,
  runStoryEvaluationAgentV2,
  type StoryEvaluationAgentResult,
} from '@app/agents'

interface TestStoryPayload {
  storyId: string
  /** The CI Run UUID */
  runId: string
  /** The Daytona Sandbox ID */
  daytonaSandboxId: string
  /** The agent version to use (v1 or v2) */
  agentVersion?: 'v1' | 'v2'
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
      const agentVersion = payload.agentVersion ?? 'v2'

      /**
       * 💎 Run Story Evaluation Agent
       */
      let evaluation: StoryEvaluationAgentResult
      let normalized: StoryTestResultPayload

      if (agentVersion === 'v2') {
        const evaluationV2 = await runStoryEvaluationAgentV2({
          ...storyRecord,
          runId: payload.runId,
          daytonaSandboxId: payload.daytonaSandboxId,
          maxSteps: 30,
        })
        evaluation = evaluationV2
        normalized = normalizeStoryTestResultV2(
          evaluationV2.output,
          startedAt,
          new Date(),
        )
      } else {
        const evaluationV1 = await runStoryEvaluationAgent({
          ...storyRecord,
          runId: payload.runId,
          daytonaSandboxId: payload.daytonaSandboxId,
          maxSteps: 30,
        })
        evaluation = evaluationV1
        normalized = normalizeStoryTestResult(
          evaluationV1.output,
          startedAt,
          new Date(),
        )
      }

      logger.info('Story evaluation agent completed', {
        storyId: payload.storyId,
        runId: payload.runId,
        resultId,
        agentVersion,
        finishReason: evaluation.finishReason,
        agentSteps: evaluation.metrics.stepCount,
        contextToolCalls: evaluation.metrics.toolCallCount,
      })

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
        conclusion: 'error' as const,
        explanation: failureDescription,
        evidence: [],
      }

      await db
        .updateTable('storyTestResults')
        .set((eb) => ({
          status: 'error',
          analysisVersion: 1,
          analysis: eb.cast(eb.val(JSON.stringify(failureAnalysis)), 'jsonb'),
          completedAt: new Date(),
        }))
        .where('id', '=', resultId)
        .execute()

      throw error
    }
  },
})
