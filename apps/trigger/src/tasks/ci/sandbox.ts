import pMap from 'p-map'
import type { RunStory } from '@app/db'
import { agents } from '@app/agents'
import { setupDb } from '@app/db'
import { parseEnv } from '@app/config'
import type { RepoRecord, StoryRow } from './types'
import { aggregateBatchResults, type AggregatedRunOutcome } from './results'
import { testStoryTask } from '../test-story'
import { createDaytonaSandbox } from '../../helpers/daytona'
import { saveCachedEvidence, buildCacheDataFromEvaluation } from '@app/cache'
import { logger } from '@trigger.dev/sdk'

interface RunStoriesWithSandboxParams {
  repoRecord: RepoRecord
  repo: {
    repoName: string
    ownerLogin: string
  }
  branchName: string
  commitSha: string
  stories: StoryRow[]
  initialRunStories: RunStory[]
  runId: string
  agentVersion?: string
}

export async function runStoriesWithSandbox({
  repoRecord,
  repo,
  branchName,
  commitSha,
  stories,
  initialRunStories,
  runId,
  agentVersion = agents.decomposition.version,
}: RunStoriesWithSandboxParams): Promise<AggregatedRunOutcome> {
  const env = parseEnv()
  const db = setupDb(env.DATABASE_URL)

  const sandbox = await createDaytonaSandbox({
    repoId: repoRecord.repoId,
    branchName,
    additionalLabels: {
      'kyoto.runId': runId,
    },
  })

  try {
    const batchResult = await pMap(
      stories,
      async (story) => {
        const startedAt = new Date()

        // Create an initial result row so downstream steps can stream updates
        const inserted = await db
          .insertInto('storyTestResults')
          .values({
            storyId: story.id,
            runId: runId ?? null,
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
          const taskResult = await testStoryTask.triggerAndWait(
            {
              storyId: story.id,
              daytonaSandboxId: sandbox.id,
              branchName,
              commitSha,
              runId,
            },
            {
              tags: [
                `org_${repo.ownerLogin}`,
                `repo_${repo.repoName}`,
                `agent_${agentVersion}`,
              ],
              metadata: {
                name: story.name,
                story: story.story,
              },
            },
          )

          const completedAt = new Date()

          if (taskResult.ok) {
            const evaluation = taskResult.output.evaluation

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

            // Save cache for successful evaluations
            if (
              agents.evaluation.options.cacheOptions?.enabled &&
              evaluation.status === 'pass'
            ) {
              try {
                const cacheData = await buildCacheDataFromEvaluation({
                  evaluation,
                  sandbox,
                })

                // Only save if we have cache data
                if (
                  Object.keys(cacheData.steps).length > 0 &&
                  commitSha &&
                  runId
                ) {
                  await saveCachedEvidence({
                    db,
                    branchName,
                    storyId: story.id,
                    commitSha,
                    cacheData,
                    runId,
                  })

                  logger.info('Saved cache for story', {
                    storyId: story.id,
                    branchName,
                    commitSha,
                    runId,
                  })
                }
              } catch (error) {
                // Log but don't fail the evaluation if cache save fails
                logger.warn('Failed to save cache for story', {
                  storyId: story.id,
                  error: error instanceof Error ? error.message : String(error),
                })
              }
            }
          } else {
            const failureDescription =
              taskResult.error &&
              typeof taskResult.error === 'object' &&
              'message' in taskResult.error &&
              typeof (taskResult.error as { message?: unknown }).message ===
                'string'
                ? ((taskResult.error as { message: string }).message ??
                  'Unknown error occurred')
                : 'Unknown error occurred'

            const failureAnalysis = agents.evaluation.schema.parse({
              status: 'error',
              explanation: failureDescription,
              version: 3,
              evidence: [],
            })

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
          }

          return { resultId, ...taskResult }
        } catch (error) {
          const failureDescription =
            error instanceof Error ? error.message : 'Unknown error occurred'

          const failureAnalysis = agents.evaluation.schema.parse({
            version: 3,
            status: 'error',
            explanation: failureDescription,
            steps: [],
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
      // ! can only be 1 - trigger.dev requirement
      { concurrency: 1 },
    )

    return aggregateBatchResults({
      batchResult,
      stories,
      initialRunStories,
    })
  } finally {
    await sandbox.delete()
  }
}
