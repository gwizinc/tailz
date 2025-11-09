import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface RunningCiItem {
  id: string
  number: number | null
  repoName: string
  ownerSlug: string
  branchName: string
  startedAt: string | null
  updatedAt: string | null
}

interface RunningCiListProps {
  total: number
  runs: ReadonlyArray<RunningCiItem>
}

function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) {
    return 'Start time unavailable'
  }

  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return 'Start time unavailable'
  }

  const diffMs = Date.now() - parsed.getTime()
  if (diffMs < 60_000) {
    return 'Just started'
  }

  const diffMinutes = Math.floor(diffMs / 60_000)
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function RunningCiList({ total, runs }: RunningCiListProps) {
  return (
    <Card className="h-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-base font-semibold">
          Currently running CI
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? 'All pipelines are idle.'
            : `${total} pipeline${total === 1 ? '' : 's'} in progress`}
        </p>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No CI runs are currently active.
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map((run, index) => (
              <div key={run.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span>{`${run.ownerSlug}/${run.repoName}`}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {run.branchName}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(run.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Run ID:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {run.number ?? 'N/A'}
                  </code>
                  <span>•</span>
                  <span>
                    Updated{' '}
                    {formatRelativeTime(run.updatedAt ?? run.startedAt)}
                  </span>
                </div>
                {index < runs.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

