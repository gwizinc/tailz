import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDurationMs,
  formatRelativeTime,
  getCommitTitle,
  getShortSha,
  getStatusDisplay,
} from './run-detail-view-utils'

interface RunItem {
  id: string
  runId: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'error'
  createdAt: string
  updatedAt: string
  durationMs: number
  commitSha: string | null
  commitMessage: string | null
  branchName: string
}

interface RunListProps {
  runs: RunItem[]
  orgName: string
  repoName: string
}

function mapRunStatusToDetailStatus(
  status: RunItem['status'],
): 'pass' | 'fail' | 'skipped' | 'running' | 'error' {
  switch (status) {
    case 'success':
      return 'pass'
    case 'failed':
      return 'fail'
    case 'skipped':
      return 'skipped'
    case 'running':
      return 'running'
    case 'error':
      return 'error'
    case 'queued':
      return 'running'
  }
}

export function RunList({ runs, orgName, repoName }: RunListProps) {
  if (runs.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-4"
            title="Ito-kenshō - intent testing."
          >
            いとかんしょう
          </p>
          <h2 className="text-2xl font-display text-foreground mb-3">
            What is intent testing?
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            Your commits and pull requests will soon be tested with Kyoto&apos;s
            intent testing, an AI powered QA platform with the goal of
            preventing regressions and shipping code that works according to the
            intent behind your stories.
          </p>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              window.alert('Coming soon')
            }}
          >
            <Play className="h-4 w-4" />
            Watch demo
          </Button>
        </div>
      </>
    )
  }

  return (
    <ul className="divide-y">
      {runs.map((run) => {
        const detailStatus = mapRunStatusToDetailStatus(run.status)
        const statusDisplay = getStatusDisplay(detailStatus)
        const StatusIcon = statusDisplay.Icon
        const commitTitle = getCommitTitle(run.commitMessage)
        const shortSha = getShortSha(run.commitSha, '—')
        const relativeTime = formatRelativeTime(run.createdAt)
        const durationDisplay = formatDurationMs(run.durationMs)

        return (
          <li key={run.id}>
            <a
              href={`/org/${orgName}/repo/${repoName}/runs/${run.runId}`}
              className="flex items-start gap-3 py-3 px-4 hover:bg-accent/50 transition-colors"
            >
              <div className="mt-0.5">
                <StatusIcon
                  className={`size-4 ${statusDisplay.chipIconClassName} ${
                    statusDisplay.shouldSpin ? 'animate-spin' : ''
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {commitTitle}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span>
                    CI #{run.runId}: Commit {shortSha}
                  </span>
                  {' • '}
                  <span>{relativeTime}</span>
                  {' • '}
                  <span>{durationDisplay}</span>
                </div>
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
