import { task, logger } from '@trigger.dev/sdk'
import type { StoryTestResult } from '../types'
import { createInstallationOctokit } from '../helpers/github'

export interface CreateGitHubCheckParams {
  orgSlug: string
  repoName: string
  commitSha: string
  appId: number
  privateKey: string
  installationId: number
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion?:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'timed_out'
    | 'action_required'
  output?: {
    title: string
    summary: string
    text?: string
  }
}

export interface UpdateGitHubCheckParams extends CreateGitHubCheckParams {
  checkRunId: number
}

export async function createGitHubCheck(
  params: CreateGitHubCheckParams,
): Promise<number> {
  const {
    orgSlug,
    repoName,
    commitSha,
    appId,
    privateKey,
    installationId,
    name,
    status,
    conclusion,
    output,
  } = params

  const octokit = createInstallationOctokit({
    appId,
    privateKey,
    installationId,
  })

  const checkRun = await octokit.rest.checks.create({
    owner: orgSlug,
    repo: repoName,
    name,
    head_sha: commitSha,
    status,
    conclusion,
    output,
  })

  return checkRun.data.id
}

export async function updateGitHubCheck(
  params: UpdateGitHubCheckParams,
): Promise<void> {
  const {
    orgSlug,
    repoName,
    appId,
    privateKey,
    installationId,
    checkRunId,
    status,
    conclusion,
    output,
  } = params

  const octokit = createInstallationOctokit({
    appId,
    privateKey,
    installationId,
  })

  await octokit.rest.checks.update({
    owner: orgSlug,
    repo: repoName,
    check_run_id: checkRunId,
    status,
    conclusion,
    output,
  })
}

export function mapRunStatusToConclusion(
  status: 'pass' | 'fail' | 'skipped' | 'running',
): 'success' | 'failure' | 'neutral' | 'cancelled' | undefined {
  switch (status) {
    case 'pass':
      return 'success'
    case 'fail':
      return 'failure'
    case 'skipped':
      return 'neutral'
    case 'running':
      return undefined
    default:
      return undefined
  }
}

export function mapRunStatusToCheckStatus(
  status: 'pass' | 'fail' | 'skipped' | 'running',
): 'queued' | 'in_progress' | 'completed' {
  switch (status) {
    case 'running':
      return 'in_progress'
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
      appId: number
      privateKey: string
      installationId: number
      checkRunId?: number
    },
    { ctx: _ctx },
  ) => {
    logger.info('Updating run with results', {
      runId: payload.runId,
      resultCount: payload.testResults.length,
    })

    const hasFail = payload.testResults.some((s) => s.status === 'fail')
    const allSkipped = payload.testResults.every((s) => s.status === 'skipped')
    const finalStatus: 'pass' | 'fail' | 'skipped' = hasFail
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
    const skippedCount = payload.testResults.filter(
      (s) => s.status === 'skipped',
    ).length

    const output = {
      title: `Run completed: ${finalStatus}`,
      summary: `${passedCount} passed, ${failedCount} failed, ${skippedCount} skipped`,
      text: `Total stories: ${payload.testResults.length}\nPassed: ${passedCount}\nFailed: ${failedCount}\nSkipped: ${skippedCount}`,
    }

    try {
      if (payload.checkRunId) {
        await updateGitHubCheck({
          orgSlug: payload.orgSlug,
          repoName: payload.repoName,
          commitSha: payload.commitSha,
          appId: payload.appId,
          privateKey: payload.privateKey,
          installationId: payload.installationId,
          checkRunId: payload.checkRunId,
          name: 'Tailz/CI',
          status: checkStatus,
          conclusion,
          output,
        })
      } else {
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
      }
    } catch (error) {
      logger.warn('Failed to update GitHub check, creating new one', { error })
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
