import { logger, task } from '@trigger.dev/sdk'
import { setupDb } from '@app/db'
import { parseEnv } from '@app/config'
import { getGithubBranchDetails, getOctokitClient } from '../../helpers/github'
import {
  buildCheckRunBase,
  completeCheckRunFailure,
  completeCheckRunSuccess,
  endBecauseNoStoriesExist,
  startCheckRun,
} from './check-runs'
import {
  buildInitialRunStories,
  buildRunDetailsUrl,
  createRunRecord,
  getBranchName,
  getInitialRunMeta,
  getRepoRecord,
  getStories,
} from './setup'
import { markRunFailure, updateRunResults } from './results'
import { runStoriesWithSandbox } from './sandbox'
import type { RunCiPayload } from './types'

export const runCiTask = task({
  id: 'run-ci',
  run: async (payload: RunCiPayload) => {
    const env = parseEnv()
    const db = setupDb(env.DATABASE_URL)

    const branchName = getBranchName(payload)
    const repoRecord = await getRepoRecord(db, payload)

    logger.info(
      `👉 ${repoRecord.ownerLogin}/${repoRecord.repoName}#${branchName}`,
      { payload },
    )

    const stories = await getStories(db, repoRecord.repoId)
    const initialRunStories = buildInitialRunStories(stories)
    const { runStatus, runSummary } = getInitialRunMeta(stories)

    const { repo, octokit } = await getOctokitClient(repoRecord.repoId)

    // commitSha is latest on that branch
    // TODO we may need to provide as an argument to the task
    const { commitSha, commitMessage, gitAuthor } =
      await getGithubBranchDetails(octokit, {
        owner: repoRecord.ownerLogin,
        repo: repoRecord.repoName,
        branch: branchName,
      })

    const runInsert = await createRunRecord({
      db,
      repoId: repoRecord.repoId,
      branchName,
      runStatus,
      initialRunStories,
      commitSha,
      commitMessage,
      runSummary,
      prNumber: payload.prNumber ?? null,
      gitAuthor,
    })

    const runId = runInsert.id
    const detailsUrl = buildRunDetailsUrl(
      env.SITE_BASE_URL,
      repoRecord,
      runInsert.number,
    )

    const checkRunBase = buildCheckRunBase({
      commitSha,
      octokit,
      repoRecord,
      runId,
      runNumber: runInsert.number,
      branchName,
      detailsUrl,
    })

    const checkRunId = await startCheckRun({
      checkRunBase,
      storiesCount: stories.length,
      repoId: repoRecord.repoId,
      branchName,
      runId,
    })

    logger.info('Created run record', {
      runId,
      repoId: repoRecord.repoId,
      branchName,
      storyCount: stories.length,
      commitSha,
      detailsUrl,
    })

    if (stories.length === 0) {
      return await endBecauseNoStoriesExist({
        checkRunBase,
        checkRunId,
        runId,
        runNumber: runInsert.number,
        branchName,
      })
    }

    try {
      const {
        aggregated,
        updatedRunStories,
        finalStatus,
        summaryText,
        summaryParts,
      } = await runStoriesWithSandbox({
        repoRecord,
        repo,
        branchName,
        commitSha,
        stories,
        initialRunStories,
        runId,
        agentVersion: payload.agentVersion,
      })

      await updateRunResults({
        db,
        runId,
        finalStatus,
        summaryText,
        updatedRunStories,
      })

      logger.debug('🙏 Completed run evaluation', {
        runId,
        finalStatus,
        summaryParts,
      })

      await completeCheckRunSuccess({
        checkRunBase,
        checkRunId,
        runId,
        branchName,
        status: finalStatus,
        summary: summaryText,
        counts: aggregated,
      })

      return {
        success: true,
        runId,
        runNumber: runInsert.number,
        status: finalStatus,
        summary: summaryText,
        stories: updatedRunStories,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Run execution failed'

      logger.error('Run CI task failed', {
        runId,
        error,
      })

      await markRunFailure({
        db,
        runId,
        summary: errorMessage,
        status: 'error',
      })

      await completeCheckRunFailure({
        checkRunBase,
        checkRunId,
        runId,
        branchName,
        summary: errorMessage,
        status: 'error',
      })

      throw error
    }
  },
})
