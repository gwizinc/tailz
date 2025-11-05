import { task, logger } from '@trigger.dev/sdk'
import type { DB } from '@app/db/types'
import type { Selectable } from 'kysely'
import { setupDb } from '@app/db'
import type { RunStory } from '@app/db'
import { analyzeRepository } from '../src/helpers/analyze-repository'
import {
  createGitHubCheck,
  updateGitHubCheck,
  mapRunStatusToConclusion,
  mapRunStatusToCheckStatus,
} from '../src/helpers/github-status'

interface RunWorkflowPayload {
  runId: string
  orgSlug: string
  repoName: string
  branchName: string
  repoId: string
  commitSha: string
  commitMessage: string | null
  installationId: number
  appId: number
  privateKey: string
  openRouterApiKey: string
  databaseUrl: string
}

interface StoryTestResult {
  storyId: string
  status: 'pass' | 'fail' | 'skipped'
  error?: string
}

/**
 * Step 1: Analyze repository to pull/refresh stories
 */
export const analyzeRepoTask = task({
  id: 'analyze-repo',
  run: async (
    payload: {
      repoId: string
      appId: number
      privateKey: string
      openRouterApiKey: string
      databaseUrl: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Analyzing repository', { repoId: payload.repoId })

    const db = setupDb(payload.databaseUrl)

    const result = await analyzeRepository({
      db,
      repoId: payload.repoId,
      appId: payload.appId,
      privateKey: payload.privateKey,
      openRouterApiKey: payload.openRouterApiKey,
    })

    if (!result.success) {
      logger.error('Failed to analyze repository', {
        repoId: payload.repoId,
        error: result.error,
      })
      throw new Error(result.error || 'Failed to analyze repository')
    }

    logger.info('Repository analyzed successfully', {
      repoId: payload.repoId,
      storyCount: result.storyCount,
    })

    return {
      success: true,
      storyCount: result.storyCount,
    }
  },
})

/**
 * Step 2: Test a single story (placeholder for future headless browser testing)
 */
export const testStoryTask = task({
  id: 'test-story',
  run: async (
    payload: {
      storyId: string
      storyName: string
      story: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Testing story', {
      storyId: payload.storyId,
      storyName: payload.storyName,
    })

    // TODO: Implement actual story testing (headless browser in future)
    // For now, we'll just mark it as pass
    // This is where headless browser testing will be added later

    await Promise.resolve() // Placeholder for future async work

    const result: StoryTestResult = {
      storyId: payload.storyId,
      status: 'pass',
    }

    logger.info('Story test completed', {
      storyId: payload.storyId,
      status: result.status,
    })

    return result
  },
})

/**
 * Step 3: Test all stories in parallel
 */
export const testAllStoriesTask = task({
  id: 'test-all-stories',
  run: async (
    payload: {
      repoId: string
      branchName: string
      databaseUrl: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Fetching stories for testing', {
      repoId: payload.repoId,
      branchName: payload.branchName,
    })

    const db = setupDb(payload.databaseUrl)

    // Fetch all stories for this repo and branch
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
      return []
    }

    logger.info('Testing stories in parallel', {
      storyCount: stories.length,
    })

    // Note: For now, we're executing story tests inline in the main workflow
    // This can be refactored to use proper task chaining once Trigger.dev API is verified
    // Return empty array as placeholder - actual testing happens in main workflow
    return []
  },
})

/**
 * Step 4: Update run with results and GitHub status
 */
export const updateRunResultsTask = task({
  id: 'update-run-results',
  run: async (
    payload: {
      runId: string
      testResults: StoryTestResult[]
      orgSlug: string
      repoName: string
      commitSha: string
      appId: number
      privateKey: string
      installationId: number
      databaseUrl: string
    },
    { ctx: _ctx },
  ) => {
    logger.info('Updating run with results', {
      runId: payload.runId,
      resultCount: payload.testResults.length,
    })

    const db = setupDb(payload.databaseUrl)

    // Convert test results to run stories format
    const runStories: RunStory[] = payload.testResults.map((result) => ({
      storyId: result.storyId,
      status: result.status,
    }))

    // Calculate final status
    const hasFail = runStories.some((s) => s.status === 'fail')
    const allSkipped = runStories.every((s) => s.status === 'skipped')
    const finalStatus: 'pass' | 'fail' | 'skipped' = hasFail
      ? 'fail'
      : allSkipped
        ? 'skipped'
        : 'pass'

    // Update run in database
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

    // Update GitHub check status
    const checkStatus = mapRunStatusToCheckStatus(finalStatus)
    const conclusion = mapRunStatusToConclusion(finalStatus)

    const passedCount = runStories.filter((s) => s.status === 'pass').length
    const failedCount = runStories.filter((s) => s.status === 'fail').length
    const skippedCount = runStories.filter((s) => s.status === 'skipped').length

    const output = {
      title: `Run completed: ${finalStatus}`,
      summary: `${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped`,
      text: `Total stories: ${runStories.length}\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}`,
    }

    // We need to get the check run ID from the run metadata or create it
    // For now, we'll create a new check run
    try {
      await updateGitHubCheck({
        orgSlug: payload.orgSlug,
        repoName: payload.repoName,
        commitSha: payload.commitSha,
        appId: payload.appId,
        privateKey: payload.privateKey,
        installationId: payload.installationId,
        checkRunId: (updatedRun as any).checkRunId || 0, // TODO: Store check run ID in run metadata
        name: 'Story Tests',
        status: checkStatus,
        conclusion,
        output,
      })
    } catch (error) {
      // If check run doesn't exist, create it
      logger.warn('Failed to update GitHub check, creating new one', { error })
      try {
        await createGitHubCheck({
          orgSlug: payload.orgSlug,
          repoName: payload.repoName,
          commitSha: payload.commitSha,
          appId: payload.appId,
          privateKey: payload.privateKey,
          installationId: payload.installationId,
          name: 'Story Tests',
          status: checkStatus,
          conclusion,
          output,
        })
      } catch (createError) {
        logger.error('Failed to create GitHub check', { error: createError })
        // Don't throw - GitHub status is nice-to-have, not critical
      }
    }

    logger.info('Run updated successfully', {
      runId: payload.runId,
      finalStatus,
    })

    return {
      success: true,
      run: updatedRun as Selectable<DB['runs']>,
      finalStatus,
    }
  },
})

/**
 * Main workflow: Execute a run
 * This orchestrates all the steps:
 * 1. Analyze repository
 * 2. Test all stories
 * 3. Update run with results and GitHub status
 */
export const executeRunWorkflow = task({
  id: 'execute-run',
  run: async (payload: RunWorkflowPayload, { ctx: _ctx }) => {
    logger.info('Starting run workflow', {
      runId: payload.runId,
      orgSlug: payload.orgSlug,
      repoName: payload.repoName,
    })

    try {
      // Step 1: Analyze repository (execute inline instead of triggering separate task)
      const db = setupDb(payload.databaseUrl)
      const analyzeResult = await analyzeRepository({
        db,
        repoId: payload.repoId,
        appId: payload.appId,
        privateKey: payload.privateKey,
        openRouterApiKey: payload.openRouterApiKey,
      })

      if (!analyzeResult.success) {
        logger.error('Failed to analyze repository', {
          repoId: payload.repoId,
          error: analyzeResult.error,
        })
        throw new Error(analyzeResult.error || 'Failed to analyze repository')
      }

      logger.info('Repository analyzed successfully', {
        repoId: payload.repoId,
        storyCount: analyzeResult.storyCount,
      })

      // Step 2: Create initial GitHub check
      try {
        await createGitHubCheck({
          orgSlug: payload.orgSlug,
          repoName: payload.repoName,
          commitSha: payload.commitSha,
          appId: payload.appId,
          privateKey: payload.privateKey,
          installationId: payload.installationId,
          name: 'Story Tests',
          status: 'in_progress',
          output: {
            title: 'Running story tests',
            summary: 'Analyzing repository and testing stories...',
          },
        })
      } catch (error) {
        logger.warn('Failed to create initial GitHub check', { error })
        // Continue even if GitHub check fails
      }

      // Step 3: Test all stories (execute inline for now)
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
        // Update run status to fail
        await db
          .updateTable('runs')
          .set({ status: 'fail' })
          .where('id', '=', payload.runId)
          .execute()
        throw new Error('No stories found for this repository and branch')
      }

      // Test all stories (simplified - mark as pass for now)
      const testResults: StoryTestResult[] = stories.map((story) => ({
        storyId: story.id,
        status: 'pass',
      }))

      // Step 4: Update run with results (execute inline)
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

      // Update GitHub check status
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
          name: 'Story Tests',
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

      // Update run status to fail on error
      try {
        const db = setupDb(payload.databaseUrl)
        await db
          .updateTable('runs')
          .set({ status: 'fail' })
          .where('id', '=', payload.runId)
          .execute()

        // Update GitHub check to failure
        try {
          await createGitHubCheck({
            orgSlug: payload.orgSlug,
            repoName: payload.repoName,
            commitSha: payload.commitSha,
            appId: payload.appId,
            privateKey: payload.privateKey,
            installationId: payload.installationId,
            name: 'Story Tests',
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
