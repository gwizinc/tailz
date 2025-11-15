import { task, logger } from '@trigger.dev/sdk'

import { setupDb } from '@app/db'

import { agents, getDaytonaSandbox } from '@app/agents'
import { parseEnv } from '@app/config'
import { getTelemetryTracer } from '@/telemetry'
import type { EvaluationAnalysisResult } from '@app/schemas'
import {
  createDaytonaSandbox,
  getCommitSHAsFromSandbox,
} from '@/helpers/daytona'
import { getCachedEvidence, validateCacheEntry } from '@app/cache'

export type TestStoryTaskResult = {
  evaluation: EvaluationAnalysisResult
}

export const testStoryTask = task({
  id: 'test-story',
  run: async (payload: {
    storyId: string
    /** The Daytona Sandbox ID */
    daytonaSandboxId?: string
    /** The branch name for cache lookup */
    branchName?: string
    /** The commit SHA for cache lookup */
    commitSha?: string
    /** The run ID for cache metadata */
    runId?: string
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

    // Check cache if enabled and branchName/runId are provided
    let cacheEntry = null
    let validationResult = null

    if (
      agents.evaluation.options.cacheOptions?.enabled &&
      payload.runId &&
      daytonaSandboxId
    ) {
      const db = setupDb(DATABASE_URL)

      // Get sandbox to query git log for commit SHAs
      const sandbox = await getDaytonaSandbox(daytonaSandboxId)

      // Get all commit SHAs from the current branch
      const commitSHAs = await getCommitSHAsFromSandbox(sandbox)

      if (!commitSHAs) {
        logger.warn('Failed to get git log, skipping cache lookup', {
          storyId: storyRecord.id,
        })
      } else {
        logger.info('Found commit SHAs in branch', {
          storyId: storyRecord.id,
          commitCount: commitSHAs.length,
        })

        // Search for cache entry - query database with all commit SHAs at once
        // Returns the latest commit SHA that has a cache entry
        cacheEntry = await getCachedEvidence({
          db,
          storyId: storyRecord.id,
          commitSha: commitSHAs,
        })

        if (cacheEntry) {
          logger.info('Found cache entry for story', {
            storyId: storyRecord.id,
            commitSha: cacheEntry.commitSha,
            runId: cacheEntry.runId,
          })

          // Validate cache entry
          const validation = await validateCacheEntry({
            cacheEntry,
            sandbox,
            invalidationStrategy:
              agents.evaluation.options.cacheOptions.invalidationStrategy,
          })

          validationResult = validation

          if (validation.isValid) {
            logger.info('Cache entry is valid, using cached results', {
              storyId: storyRecord.id,
            })
          } else {
            logger.info('Cache entry is invalid, will re-evaluate', {
              storyId: storyRecord.id,
              invalidSteps: validation.invalidSteps,
              invalidAssertions: validation.invalidAssertions,
            })
          }
        } else {
          logger.info('No cache entry found for any commit in branch', {
            storyId: storyRecord.id,
            commitCount: commitSHAs.length,
          })
        }
      }
    }

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
        branchName: payload.branchName,
        runId: payload.runId,
        cacheEntry,
        validationResult,
      },
    })

    logger.info(
      `Story evaluation ${evaluation.status === 'pass' ? '🟢' : '🔴'}`,
      { evaluation },
    )

    return { evaluation }
  },
})
