import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MinusCircle,
  Play,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`
  }
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'just now'
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function getStatusIcon(status: RunItem['status']) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="size-4 text-chart-1" />
    case 'failed':
      return <XCircle className="size-4 text-destructive" />
    case 'error':
      return <AlertTriangle className="size-4 text-orange-600" />
    case 'skipped':
      return <MinusCircle className="size-4 text-muted-foreground" />
    case 'running':
      return <Loader2 className="size-4 text-primary animate-spin" />
    case 'queued':
      return <Clock className="size-4 text-chart-4" />
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
        const statusIcon = getStatusIcon(run.status)
        const commitTitle =
          run.commitMessage?.split('\n')[0]?.trim() || 'No commit message'
        const shortSha = run.commitSha ? run.commitSha.slice(0, 7) : '—'

        return (
          <li key={run.id}>
            <a
              href={`/org/${orgName}/repo/${repoName}/runs/${run.runId}`}
              className="flex items-start gap-3 py-3 px-4 hover:bg-accent/50 transition-colors"
            >
              <div className="mt-0.5">{statusIcon}</div>
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
                  <span>{formatDate(run.createdAt)}</span>
                  {' • '}
                  <span>{formatDuration(run.durationMs)}</span>
                </div>
              </div>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
