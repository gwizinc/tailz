import { task, logger } from '@trigger.dev/sdk'

import { setupDb, type StoryTestResultPayload } from '@app/db'

import {
  parseEnv,
  normalizeStoryTestResult,
  runStoryEvaluationAgent,
  type AgentVersion,
} from '@app/agents'
import { getTelemetryTracer } from '@/telemetry'

interface TestStoryPayload {
  storyId: string
  /** The CI Run UUID */
  runId: string
  /** The Daytona Sandbox ID */
  daytonaSandboxId: string
  agentVersion?: AgentVersion
  // TODO support if daytonaSandboxId is null so we can create a new sandbox for this single story execution
}

interface TestStoryResult {
  success: boolean
  storyId: string
  runId: string | null
  resultId: string
  status: StoryTestResultPayload['status']
  analysisVersion: StoryTestResultPayload['analysisVersion']
  analysis: StoryTestResultPayload['analysis']
}

export type TestStoryTaskTriggerResult =
  | {
      ok: true
      output: TestStoryResult
      error?: undefined
    }
  | {
      ok: false
      error: unknown
      output?: undefined
    }

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: TestStoryPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    // Look up the story and associated repository metadata needed for testing
    const storyRecord = await db
      .selectFrom('stories')
      .innerJoin('repos', 'repos.id', 'stories.repoId')
      .innerJoin('owners', 'owners.id', 'repos.ownerId')
      .select([
        'stories.id as id',
        'stories.story as story',
        'stories.repoId as repoId',
        'stories.name as name',
        'owners.login as ownerName',
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
        repo: {
          id: storyRecord.repoId,
          slug: `${storyRecord.ownerName}/${storyRecord.repoName}`,
        },
        story: {
          id: storyRecord.id,
          name: storyRecord.name,
          text: storyRecord.story,
        },
        run: {
          id: payload.runId,
        },
        options: {
          daytonaSandboxId: payload.daytonaSandboxId,
          telemetryTracer: getTelemetryTracer(),
        },
      })

      // TODO do we need this??? Post processing
      const normalized = normalizeStoryTestResult(
        evaluation.output,
        startedAt,
        new Date(),
      )

      await db
        .updateTable('storyTestResults')
        .set((eb) => ({
          status: normalized.status,
          analysisVersion: normalized.analysisVersion,
          analysis:
            normalized.analysis !== null
              ? eb.cast(eb.val(JSON.stringify(normalized.analysis)), 'jsonb')
              : eb.val(null),
          completedAt: new Date(),
          durationMs: normalized.durationMs,
        }))
        .where('id', '=', resultId)
        .execute()

      logger.info(
        `Story evaluation ${evaluation.output.status === 'pass' ? '🟢' : '🔴'}`,
        {
          storyId: payload.storyId,
          runId: payload.runId,
          evaluation,
          status: normalized.status,
          resultId,
        },
      )

      const result: TestStoryResult = {
        // Provide a succinct summary for orchestration tasks and UI consumption
        success: true,
        storyId: payload.storyId,
        runId: payload.runId ?? null,
        resultId,
        status: normalized.status,
        analysisVersion: normalized.analysisVersion,
        analysis: normalized.analysis,
      }
      return result
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
