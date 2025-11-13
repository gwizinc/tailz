import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'

import { agents } from '@app/agents'
import { parseEnv } from '@app/config'
import { getTelemetryTracer } from '@/telemetry'
import type { EvaluationAnalysisResult } from 'node_modules/@app/agents/src/agents/schema'
import { createDaytonaSandbox } from '@/helpers/daytona'

export type TestStoryTaskResult = {
  evaluation: EvaluationAnalysisResult
}

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: {
    storyId: string
    /** The Daytona Sandbox ID */
    daytonaSandboxId?: string
  }): Promise<TestStoryTaskResult> => {
    const { DATABASE_URL } = parseEnv()
    const db = setupDb(DATABASE_URL)

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

    // We can create a new sandbox if one is not provided
    let daytonaSandboxId = payload.daytonaSandboxId
    if (!payload.daytonaSandboxId) {
      const sandbox = await createDaytonaSandbox({
        repoId: storyRecord.repoId,
      })
      daytonaSandboxId = sandbox.id
    }

    console.log('🌸', { storyRecord, payload, daytonaSandboxId })

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
      options: {
        daytonaSandboxId,
        telemetryTracer: getTelemetryTracer(),
      },
    })

    logger.info(
      `Story evaluation ${evaluation.status === 'pass' ? '🟢' : '🔴'}`,
      { evaluation },
    )

    return { evaluation }
  },
})
