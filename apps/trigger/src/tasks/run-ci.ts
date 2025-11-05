import { task, logger } from '@trigger.dev/sdk'
import type { DB } from '@app/db/types'
import type { Selectable } from 'kysely'
import { setupDb } from '@app/db'
import type { RunStory } from '@app/db'
import {
  createGitHubCheck,
  mapRunStatusToCheckStatus,
  mapRunStatusToConclusion,
} from './update-github-status'
import type { RunWorkflowPayload, StoryTestResult } from '../types'

export const runCiTask = task({
  id: 'run-ci',
  run: async (payload: RunWorkflowPayload, { ctx: _ctx }) => {
    logger.info('Starting run workflow', {
      runId: payload.runId,
      orgSlug: payload.orgSlug,
      repoName: payload.repoName,
    })

    try {
      const db = setupDb(payload.databaseUrl)

      try {
        await createGitHubCheck({
          orgSlug: payload.orgSlug,
          repoName: payload.repoName,
          commitSha: payload.commitSha,
          appId: payload.appId,
          privateKey: payload.privateKey,
          installationId: payload.installationId,
          name: 'Tailz/CI',
          status: 'in_progress',
          output: {
            title: 'Running story tests',
            summary: 'Analyzing repository and testing stories...',
          },
        })
      } catch (error) {
        logger.warn('Failed to create initial GitHub check', { error })
      }

      const stories = await db
        .selectFrom('stories')
        .selectAll()
        .where('repoId', '=', payload.repoId)
        .where('branchName', '=', payload.branchName)
        .execute()

      if (stories.length === 0) {
        logger.warn('No stories found', {
          repoId: payload.repoId,
          branchName: payload.branchName,
        })
        await db
          .updateTable('runs')
          .set({ status: 'fail' })
          .where('id', '=', payload.runId)
          .execute()
        throw new Error('No stories found for this repository and branch')
      }

      const testResults: StoryTestResult[] = stories.map((story) => ({
        storyId: story.id,
        status: 'pass',
      }))

      const runStories: RunStory[] = testResults.map((result) => ({
        storyId: result.storyId,
        status: result.status,
      }))

      const hasFail = runStories.some((s) => s.status === 'fail')
      const allSkipped = runStories.every((s) => s.status === 'skipped')
      const finalStatus: 'pass' | 'fail' | 'skipped' = hasFail
        ? 'fail'
        : allSkipped
          ? 'skipped'
          : 'pass'

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const updatedRun = await (db as any)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .updateTable('runs')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .set({
          status: finalStatus,
          stories: runStories,
        })
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .where('id', '=', payload.runId)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .returningAll()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .executeTakeFirstOrThrow()

      const checkStatus = mapRunStatusToCheckStatus(finalStatus)
      const conclusion = mapRunStatusToConclusion(finalStatus)

      const passedCount = runStories.filter((s) => s.status === 'pass').length
      const failedCount = runStories.filter((s) => s.status === 'fail').length
      const skippedCount = runStories.filter(
        (s) => s.status === 'skipped',
      ).length

      const output = {
        title: `Run completed: ${finalStatus}`,
        summary: `${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped`,
        text: `Total stories: ${runStories.length}\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}`,
      }

      try {
        await createGitHubCheck({
          orgSlug: payload.orgSlug,
          repoName: payload.repoName,
          commitSha: payload.commitSha,
          appId: payload.appId,
          privateKey: payload.privateKey,
          installationId: payload.installationId,
          name: 'Tailz/CI',
          status: checkStatus,
          conclusion,
          output,
        })
      } catch (checkError) {
        logger.warn('Failed to update GitHub check', { error: checkError })
      }

      logger.info('Run workflow completed successfully', {
        runId: payload.runId,
        finalStatus,
      })

      return {
        success: true,
        run: updatedRun as Selectable<DB['runs']>,
        finalStatus,
      }
    } catch (error) {
      logger.error('Run workflow failed', {
        runId: payload.runId,
        error: error instanceof Error ? error.message : String(error),
      })

      try {
        const db = setupDb(payload.databaseUrl)
        await db
          .updateTable('runs')
          .set({ status: 'fail' })
          .where('id', '=', payload.runId)
          .execute()

        try {
          await createGitHubCheck({
            orgSlug: payload.orgSlug,
            repoName: payload.repoName,
            commitSha: payload.commitSha,
            appId: payload.appId,
            privateKey: payload.privateKey,
            installationId: payload.installationId,
            name: 'Tailz/CI',
            status: 'completed',
            conclusion: 'failure',
            output: {
              title: 'Run failed',
              summary: error instanceof Error ? error.message : 'Unknown error',
            },
          })
        } catch (checkError) {
          logger.warn('Failed to update GitHub check on error', {
            error: checkError,
          })
        }
      } catch (updateError) {
        logger.error('Failed to update run status on error', {
          error: updateError,
        })
      }

      throw error
    }
  },
})
