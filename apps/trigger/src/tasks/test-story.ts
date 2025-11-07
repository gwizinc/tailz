import { task, logger } from '@trigger.dev/sdk'

import { setupDb, sql } from '@app/db'

import { parseEnv } from '../helpers/env'
import {
  normalizeStoryTestResult,
  runStoryEvaluationAgent,
} from '../helpers/story-evaluator'

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
    const inserted = await sql<{
      id: string
    }>`
      INSERT INTO public.story_test_results (story_id, run_id, status, started_at)
      VALUES (${payload.storyId}, ${payload.runId ?? null}, 'running', ${startedAt})
      RETURNING id
    `.execute(db)

    const resultRow = inserted.rows[0]
    const resultId = resultRow?.id

    if (!resultId) {
      throw new Error('Failed to create story test result record')
    }

    try {
      /**
       * 💎 Run Story Evaluation Agent
       */
      const evaluation = await runStoryEvaluationAgent({
        storyName: storyRecord.storyName,
        storyText: storyRecord.storyText,
        repoId: storyRecord.repoId,
        repoName: storyRecord.repoName,
        branchName: storyRecord.branchName,
        commitSha: storyRecord.commitSha,
        runId: payload.runId ?? null,
        maxSteps: 6,
        // TODO: Promote model configuration to env when we tune for cost vs quality.
        openAiApiKey: env.OPENAI_API_KEY,
      })

      logger.info('Story evaluation agent completed', {
        storyId: payload.storyId,
        runId: payload.runId,
        resultId,
        finishReason: evaluation.finishReason,
        agentSteps: evaluation.stepSummaries.length,
        contextToolCalls: evaluation.toolTrace.length,
      })

      const modelOutput = evaluation.output

      /**
       * 💎 Normalize and Persist Story Test Result
       */
      const normalized = normalizeStoryTestResult(
        modelOutput,
        startedAt,
        new Date(),
        evaluation.stepSummaries,
      )

      await sql`
        UPDATE public.story_test_results
        SET
          status = ${normalized.status},
          summary = ${normalized.summary},
          findings = ${JSON.stringify(normalized.findings)}::jsonb,
          issues = ${JSON.stringify(normalized.issues)}::jsonb,
          missing_requirements = ${JSON.stringify(normalized.missingRequirements)}::jsonb,
          code_references = ${JSON.stringify(normalized.codeReferences)}::jsonb,
          reasoning = ${JSON.stringify(normalized.reasoning)}::jsonb,
          loop_iterations = ${JSON.stringify(normalized.loopIterations)}::jsonb,
          raw_output = ${JSON.stringify(modelOutput)}::jsonb,
          metadata = ${JSON.stringify(normalized.metadata ?? {})}::jsonb,
          completed_at = ${normalized.completedAt ? new Date(normalized.completedAt) : null},
          duration_ms = ${normalized.durationMs}
        WHERE id = ${resultId}
      `.execute(db)

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
        summary: normalized.summary,
        findings: normalized.findings,
        issues: normalized.issues,
        missingRequirements: normalized.missingRequirements,
        codeReferences: normalized.codeReferences,
        metadata: normalized.metadata ?? {},
        loopIterations: normalized.loopIterations,
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

      await sql`
        UPDATE public.story_test_results
        SET
          status = 'fail',
          summary = COALESCE(summary, ${failureDescription}),
          issues = COALESCE(issues, '[]'::jsonb) || jsonb_build_array(
            jsonb_build_object(
              'title', 'Evaluation failure',
              'description', ${failureDescription},
              'references', '[]'::jsonb,
              'missing', '[]'::jsonb
            )
          ),
          completed_at = NOW()
        WHERE id = ${resultId}
      `.execute(db)

      throw error
    }
  },
})
