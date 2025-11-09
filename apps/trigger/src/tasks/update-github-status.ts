import { task, logger } from '@trigger.dev/sdk'
import type { StoryTestResult } from '../types'
import { createOctokit } from '../helpers/github'

function mapRunStatusToConclusion(
  status: 'pass' | 'fail' | 'skipped' | 'running' | 'error',
): 'success' | 'failure' | 'neutral' | 'cancelled' | undefined {
  switch (status) {
    case 'pass':
      return 'success'
    case 'fail':
      return 'failure'
    case 'error':
      return 'failure'
    case 'skipped':
      return 'neutral'
    case 'running':
      return undefined
    default:
      return undefined
  }
}

function mapRunStatusToCheckStatus(
  status: 'pass' | 'fail' | 'skipped' | 'running' | 'error',
): 'queued' | 'in_progress' | 'completed' {
  switch (status) {
    case 'running':
      return 'in_progress'
    case 'error':
    case 'pass':
    case 'fail':
    case 'skipped':
      return 'completed'
    default:
      return 'queued'
  }
}

export const updateGithubStatusTask = task({
  id: 'update-github-status',
  run: async (
    payload: {
      runId: string
      testResults: StoryTestResult[]
      orgSlug: string
      repoName: string
      commitSha: string
      installationId: number
      checkRunId?: number
    },
    { ctx: _ctx },
  ) => {
    logger.info('Updating run with results', {
      runId: payload.runId,
      resultCount: payload.testResults.length,
    })

    const hasError = payload.testResults.some((s) => s.status === 'error')
    const hasFail = payload.testResults.some((s) => s.status === 'fail')
    const allSkipped = payload.testResults.every((s) => s.status === 'skipped')
    const finalStatus: 'pass' | 'fail' | 'skipped' | 'error' = hasError
      ? 'error'
      : hasFail
        ? 'fail'
        : allSkipped
          ? 'skipped'
          : 'pass'

    const checkStatus = mapRunStatusToCheckStatus(finalStatus)
    const conclusion = mapRunStatusToConclusion(finalStatus)

    const passedCount = payload.testResults.filter(
      (s) => s.status === 'pass',
    ).length
    const failedCount = payload.testResults.filter(
      (s) => s.status === 'fail',
    ).length
    const errorCount = payload.testResults.filter(
      (s) => s.status === 'error',
    ).length
    const skippedCount = payload.testResults.filter(
      (s) => s.status === 'skipped',
    ).length

    const output = {
      title: `Run completed: ${finalStatus}`,
      summary: `${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped, ${errorCount} errors`,
      text: `Total stories: ${payload.testResults.length}\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}\nErrors: ${errorCount}`,
    }

    const octokit = createOctokit(payload.installationId)

    try {
      if (payload.checkRunId) {
        await octokit.rest.checks.update({
          owner: payload.orgSlug,
          repo: payload.repoName,
          check_run_id: payload.checkRunId,
          status: checkStatus,
          conclusion,
          output,
        })
      } else {
        await octokit.rest.checks.create({
          owner: payload.orgSlug,
          repo: payload.repoName,
          name: 'Tailz/CI',
          head_sha: payload.commitSha,
          status: checkStatus,
          conclusion,
          output,
        })
      }
    } catch (error) {
      logger.warn('Failed to update GitHub check, creating new one', { error })
      try {
        await octokit.rest.checks.create({
          owner: payload.orgSlug,
          repo: payload.repoName,
          name: 'Tailz/CI',
          head_sha: payload.commitSha,
          status: checkStatus,
          conclusion,
          output,
        })
      } catch (createError) {
        logger.error('Failed to create GitHub check', { error: createError })
      }
    }

    logger.info('Run updated successfully', {
      runId: payload.runId,
      finalStatus,
    })

    return {
      success: true,
      finalStatus,
    }
  },
})
