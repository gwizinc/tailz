import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'

import { agents } from '@app/agents'
import { parseEnv } from '@app/config'
import { getTelemetryTracer } from '@/telemetry'
import type { EvaluationAgentResult } from 'node_modules/@app/agents/src/agents/schema'

export type TestStoryTaskResult = {
  resultId: string
  evaluation: EvaluationAgentResult
}

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: {
    storyId: string
    /** The CI Run UUID */
    runId: string
    /** The Daytona Sandbox ID */
    daytonaSandboxId: string
    agentVersion?: string
  }): Promise<TestStoryTaskResult> => {
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
        'stories.decomposition as decomposition',
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
       * Agent to evaluate the story
       */
      const evaluation = await agents.evaluation.run({
        repo: {
          id: storyRecord.repoId,
          slug: `${storyRecord.ownerName}/${storyRecord.repoName}`,
        },
        story: {
          id: storyRecord.id,
          name: storyRecord.name,
          text: storyRecord.story,
          decomposition: agents.decomposition.schema.parse(
            storyRecord.decomposition,
          ),
        },
        run: {
          id: payload.runId,
        },
        options: {
          daytonaSandboxId: payload.daytonaSandboxId,
          telemetryTracer: getTelemetryTracer(),
        },
      })

      logger.info(
        `Story evaluation ${evaluation.status === 'pass' ? '🟢' : '🔴'}`,
        { evaluation },
      )

      const completedAt = new Date()

      await db
        .updateTable('storyTestResults')
        .set(() => ({
          status: evaluation.status,
          analysisVersion: evaluation.version,
          analysis: JSON.stringify(evaluation),
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        }))
        .where('id', '=', resultId)
        .execute()

      return { resultId, evaluation }
    } catch (error) {
      const failureDescription =
        error instanceof Error ? error.message : 'Unknown error occurred'

      const failureAnalysis = agents.evaluation.schema.parse({
        status: 'error',
        explanation: failureDescription,
        version: 3,
        evidence: [],
      })

      const completedAt = new Date()

      await db
        .updateTable('storyTestResults')
        .set(() => ({
          status: 'error',
          analysis: JSON.stringify(failureAnalysis),
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
        }))
        .where('id', '=', resultId)
        .execute()

      throw error
    }
  },
})
