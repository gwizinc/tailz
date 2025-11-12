import type { Octokit } from '@octokit/rest'
import { logger } from '@trigger.dev/sdk'

export type AggregatedCounts = {
  pass: number
  fail: number
  error: number
}

type RunOutcome = 'pass' | 'fail' | 'skipped' | 'error'

type BuildCheckRunContentParams =
  | {
      phase: 'start'
      runNumber: number
      runId: string
      branchName: string
      summary: string
      storyCount: number
    }
  | {
      phase: 'complete'
      runNumber: number
      runId: string
      branchName: string
      status: RunOutcome
      summary: string
      counts?: AggregatedCounts
    }

type CheckRunStatusPayload = {
  status: 'queued' | 'in_progress' | 'completed'
  conclusion?: 'success' | 'failure' | 'neutral'
  output: {
    title: string
    summary: string
    text: string
  }
}

export type CheckRunBaseParams = {
  octokit: Octokit
  owner: string
  repo: string
  headSha: string
  runId: string
  runNumber: number
  branchName: string
  detailsUrl?: string | null
}

type SubmitCheckRunParams = CheckRunBaseParams & {
  content: CheckRunStatusPayload
  existingCheckRunId?: number
}

export function formatStoryCount(count: number): string {
  const label = count === 1 ? 'story' : 'stories'
  return `${count} ${label}`
}

function mapOutcomeToConclusion(
  status: RunOutcome,
): 'success' | 'failure' | 'neutral' {
  switch (status) {
    case 'pass':
      return 'success'
    case 'fail':
      return 'failure'
    case 'error':
      return 'failure'
    case 'skipped':
    default:
      return 'neutral'
  }
}

export function buildCheckRunContent(
  params: BuildCheckRunContentParams,
): CheckRunStatusPayload {
  if (params.phase === 'start') {
    const text = [
      `Run ID: ${params.runId}`,
      `Branch: ${params.branchName}`,
      `Stories: ${formatStoryCount(params.storyCount)}`,
      params.summary,
    ].join('\n')

    return {
      status: 'in_progress',
      output: {
        title: `Intent Test #${params.runNumber} running...`,
        summary: params.summary,
        text,
      },
    }
  }

  const textLines = [
    `Run ID: ${params.runId}`,
    `Branch: ${params.branchName}`,
    `Status: ${params.status}`,
    params.summary,
  ]

  if (params.counts) {
    textLines.push(
      `Passed: ${params.counts.pass}`,
      `Failed: ${params.counts.fail}`,
      `Errors: ${params.counts.error}`,
    )
  }

  return {
    status: 'completed',
    conclusion: mapOutcomeToConclusion(params.status),
    output: {
      title: `Intent test #${params.runNumber}`,
      summary: params.summary,
      text: textLines.join('\n'),
    },
  }
}

export async function submitCheckRun({
  octokit,
  owner,
  repo,
  headSha,
  runId,
  detailsUrl,
  content,
  existingCheckRunId,
}: SubmitCheckRunParams): Promise<number | undefined> {
  const detailsUrlValue = detailsUrl ?? undefined

  try {
    if (existingCheckRunId) {
      const response = await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: existingCheckRunId,
        status: content.status,
        details_url: detailsUrlValue,
        ...(content.conclusion ? { conclusion: content.conclusion } : {}),
        output: content.output,
      })

      return response.data.id
    }

    const response = await octokit.rest.checks.create({
      owner,
      repo,
      name: 'Kyoto',
      head_sha: headSha,
      status: content.status,
      details_url: detailsUrlValue,
      ...(content.conclusion ? { conclusion: content.conclusion } : {}),
      external_id: runId,
      output: content.output,
    })

    return response.data.id
  } catch (error) {
    if (existingCheckRunId) {
      return await handleCheckRunCreateFallback({
        octokit,
        owner,
        repo,
        headSha,
        runId,
        detailsUrlValue,
        content,
        existingCheckRunId,
        error,
      })
    }

    loggerError('Failed to create GitHub check run', { runId, error })
  }

  return existingCheckRunId
}

type HandleFallbackParams = {
  octokit: Octokit
  owner: string
  repo: string
  headSha: string
  runId: string
  detailsUrlValue?: string
  content: CheckRunStatusPayload
  existingCheckRunId: number
  error: unknown
}

async function handleCheckRunCreateFallback({
  octokit,
  owner,
  repo,
  headSha,
  runId,
  detailsUrlValue,
  content,
  existingCheckRunId,
  error,
}: HandleFallbackParams): Promise<number | undefined> {
  loggerWarn('Failed to update GitHub check run, attempting create', {
    runId,
    error,
  })

  try {
    const response = await octokit.rest.checks.create({
      owner,
      repo,
      name: 'Kyoto',
      head_sha: headSha,
      status: content.status,
      details_url: detailsUrlValue,
      ...(content.conclusion ? { conclusion: content.conclusion } : {}),
      external_id: runId,
      output: content.output,
    })

    return response.data.id
  } catch (createError) {
    loggerError('Failed to create GitHub check run', {
      runId,
      error: createError,
    })

    return existingCheckRunId
  }
}

function loggerWarn(message: string, metadata: Record<string, unknown>): void {
  logger.warn(message, metadata)
}

function loggerError(message: string, metadata: Record<string, unknown>): void {
  logger.error(message, metadata)
}
