import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  GitCommit,
  Loader2,
  MinusCircle,
  Timer,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LuOrigami } from 'react-icons/lu'
import { StoryStatusCheck } from './StoryStatusCheck'

interface StoryAnalysisEvidence {
  filePath: string
  startLine: number | null
  endLine: number | null
  note: string | null
}

interface StoryAnalysis {
  conclusion: 'pass' | 'fail' | 'error'
  explanation: string
  evidence: StoryAnalysisEvidence[]
}

interface StoryResult {
  id: string
  storyId: string
  status: 'pass' | 'fail' | 'running' | 'error'
  analysisVersion: number
  analysis: StoryAnalysis | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  createdAt: string | null
  updatedAt: string | null
}

interface RunStory {
  storyId: string
  resultId: string | null
  status: 'pass' | 'fail' | 'running' | 'skipped' | 'error'
  summary: string | null
  startedAt: string | null
  completedAt: string | null
  result: StoryResult | null
  story: {
    id: string
    name: string
    story: string
    branchName: string
    commitSha: string | null
    createdAt: string
    updatedAt: string
  } | null
}

interface Run {
  id: string
  commitSha: string | null
  branchName: string
  commitMessage: string | null
  prNumber: string | null
  status: 'pass' | 'fail' | 'skipped' | 'running' | 'error'
  summary: string | null
  createdAt: string
  updatedAt: string
  stories: RunStory[]
}

interface RunDetailViewProps {
  run: Run
  orgSlug: string
  repoName: string
}

interface StatusDisplay {
  label: string
  Icon: LucideIcon
  heroClassName: string
  chipClassName: string
  chipIconClassName: string
  shouldSpin: boolean
}

function getStatusDisplay(status: Run['status']): StatusDisplay {
  switch (status) {
    case 'pass':
      return {
        label: 'Succeeded',
        Icon: CheckCircle2,
        heroClassName: 'text-chart-1',
        chipClassName: 'border-chart-1/30 bg-chart-1/10 text-chart-1',
        chipIconClassName: 'text-chart-1',
        shouldSpin: false,
      }
    case 'fail':
      return {
        label: 'Failed',
        Icon: XCircle,
        heroClassName: 'text-destructive',
        chipClassName:
          'border-destructive/30 bg-destructive/10 text-destructive',
        chipIconClassName: 'text-destructive',
        shouldSpin: false,
      }
    case 'skipped':
      return {
        label: 'Skipped',
        Icon: MinusCircle,
        heroClassName: 'text-muted-foreground',
        chipClassName: 'border-border bg-muted text-muted-foreground',
        chipIconClassName: 'text-muted-foreground',
        shouldSpin: false,
      }
    case 'running':
      return {
        label: 'In progress',
        Icon: Loader2,
        heroClassName: 'text-primary',
        chipClassName: 'border-primary/30 bg-primary/10 text-primary',
        chipIconClassName: 'text-primary',
        shouldSpin: true,
      }
    case 'error':
      return {
        label: 'Error',
        Icon: AlertTriangle,
        heroClassName: 'text-orange-600',
        chipClassName: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
        chipIconClassName: 'text-orange-600',
        shouldSpin: false,
      }
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) {
    return 'just now'
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }
  if (diffWeeks < 5) {
    return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`
  }
  return date.toLocaleDateString()
}

function formatDurationMs(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs < 1) {
    return '—'
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }
  if (durationMs < 60000) {
    return `${Math.round(durationMs / 1000)}s`
  }
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.round((durationMs % 60000) / 1000)
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function RunDetailView({ run, orgSlug, repoName }: RunDetailViewProps) {
  const statusDisplay = getStatusDisplay(run.status)
  const commitTitle =
    run.commitMessage?.split('\n')[0]?.trim() || 'Workflow run'
  const shortSha = run.commitSha ? run.commitSha.slice(0, 7) : null
  const relativeStarted = formatRelativeTime(run.createdAt)
  const absoluteStarted = formatDate(run.createdAt)
  const durationMs =
    new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime()
  const durationDisplay = formatDurationMs(
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
  )
  const commitUrl =
    run.commitSha && orgSlug && repoName
      ? `https://github.com/${orgSlug}/${repoName}/commit/${run.commitSha}`
      : null
  const pullRequestUrl =
    run.prNumber && orgSlug && repoName
      ? `https://github.com/${orgSlug}/${repoName}/pull/${run.prNumber}`
      : null
  const actorHandle = '@unknown'
  const actorInitial =
    actorHandle.length > 1 ? (actorHandle[1]?.toUpperCase() ?? '?') : '?'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Section: Metadata */}
      <div className="border-b bg-muted/30">
        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <statusDisplay.Icon
                className={cn(
                  'size-10',
                  statusDisplay.heroClassName,
                  statusDisplay.shouldSpin ? 'animate-spin' : '',
                )}
              />
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                    {commitTitle}
                  </h1>
                  <div
                    className="text-sm text-muted-foreground flex flex-wrap items-center gap-2"
                    title={absoluteStarted}
                  >
                    <span>Run triggered {relativeStarted}</span>
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5" />
                      Runtime {durationDisplay}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                statusDisplay.chipClassName,
              )}
            >
              <statusDisplay.Icon
                className={cn(
                  'size-4',
                  statusDisplay.chipIconClassName,
                  statusDisplay.shouldSpin ? 'animate-spin' : '',
                )}
              />
              {statusDisplay.label}
            </span>
          </div>

          <div className="space-y-4">
            <Card className="w-full">
              <CardContent className="grid gap-4 px-6 py-0 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                    {actorInitial}
                  </div>
                  <div className="space-y-0.5 text-sm">
                    <div className="font-medium text-foreground">
                      {actorHandle}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Committed {relativeStarted}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end lg:justify-center">
                  <GitBranch className="size-4 text-muted-foreground" />
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-mono font-medium text-blue-800">
                    {run.branchName}
                  </span>
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  <GitCommit className="size-4 text-muted-foreground underline" />
                  {commitUrl ? (
                    <a
                      href={commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-medium text-primary underline hover:text-primary/80"
                    >
                      {shortSha ?? '—'}
                    </a>
                  ) : (
                    <span className="font-mono text-xs font-medium text-foreground underline">
                      {shortSha ?? '—'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 text-sm sm:grid-cols-2">
              {run.prNumber ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground">Pull request</div>
                  <div className="text-foreground font-medium">
                    {pullRequestUrl ? (
                      <a
                        href={pullRequestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        #{run.prNumber}
                      </a>
                    ) : (
                      `#${run.prNumber}`
                    )}
                  </div>
                </div>
              ) : null}
              {run.summary ? (
                <div className="space-y-1 md:col-span-2">
                  <div className="text-muted-foreground">Summary</div>
                  <div className="text-foreground">{run.summary}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Stories Column */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <LuOrigami
              aria-hidden="true"
              className="h-4 w-4 text-muted-foreground"
            />
            Stories
          </h2>
          {run.stories.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No stories in this run.
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {run.stories.map((runStory) => {
                const storyTitle = runStory.story
                  ? runStory.story.name
                  : `Story not found (${runStory.storyId.slice(0, 8)}...)`

                const storyResult = runStory.result
                const startedTimestamp =
                  storyResult?.startedAt ?? runStory.startedAt
                const completedTimestamp =
                  storyResult?.completedAt ?? runStory.completedAt

                const durationMs =
                  storyResult?.durationMs ??
                  (startedTimestamp && completedTimestamp
                    ? new Date(completedTimestamp).getTime() -
                      new Date(startedTimestamp).getTime()
                    : null)

                const content = (
                  <>
                    <div className="mt-0.5">
                      <StoryStatusCheck status={runStory.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">
                        {storyTitle}
                      </div>
                      {runStory.summary ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {runStory.summary}
                        </div>
                      ) : null}
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">
                              Story status:
                            </span>{' '}
                            {runStory.status.toUpperCase()}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">
                              Result status:
                            </span>{' '}
                            {storyResult
                              ? storyResult.status.toUpperCase()
                              : '—'}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">
                              Result ID:
                            </span>{' '}
                            {storyResult ? storyResult.id : '—'}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">
                              Analysis version:
                            </span>{' '}
                            {storyResult ? storyResult.analysisVersion : '—'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">
                              Started:
                            </span>{' '}
                            {startedTimestamp
                              ? formatDate(startedTimestamp)
                              : '—'}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">
                              Completed:
                            </span>{' '}
                            {completedTimestamp
                              ? formatDate(completedTimestamp)
                              : '—'}
                          </span>
                          <span>
                            <span className="font-medium text-foreground">
                              Duration:
                            </span>{' '}
                            {formatDurationMs(durationMs)}
                          </span>
                        </div>
                        {storyResult ? (
                          storyResult.analysis ? (
                            <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">
                                Conclusion:{' '}
                                {storyResult.analysis.conclusion.toUpperCase()}
                              </div>
                              <div className="mt-1 text-foreground">
                                {storyResult.analysis.explanation}
                              </div>
                              {storyResult.analysis.evidence.length > 0 ? (
                                <div className="mt-2 space-y-1">
                                  <div className="font-medium text-foreground">
                                    Evidence
                                  </div>
                                  <ul className="list-disc space-y-1 pl-4">
                                    {storyResult.analysis.evidence.map(
                                      (evidence, index) => (
                                        <li
                                          key={`${storyResult.id}-evidence-${index}`}
                                        >
                                          <span className="text-foreground">
                                            {evidence.filePath}
                                          </span>
                                          {evidence.startLine !== null &&
                                          evidence.endLine !== null ? (
                                            <span>
                                              {' '}
                                              ({evidence.startLine} -{' '}
                                              {evidence.endLine})
                                            </span>
                                          ) : null}
                                          {evidence.note ? (
                                            <span className="block text-muted-foreground">
                                              {evidence.note}
                                            </span>
                                          ) : null}
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-muted-foreground">
                              Evaluation completed without additional analysis
                              details.
                            </div>
                          )
                        ) : (
                          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-muted-foreground">
                            No evaluation result recorded for this run story.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )

                if (runStory.story) {
                  return (
                    <li key={runStory.storyId}>
                      <a
                        href={`/org/${orgSlug}/repo/${repoName}/stories/${runStory.storyId}`}
                        className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/60"
                      >
                        {content}
                      </a>
                    </li>
                  )
                }

                return (
                  <li key={runStory.storyId}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      {content}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-sm font-medium text-foreground mb-2">
            Run Metadata
          </h2>
          <pre className="max-h-96 overflow-auto rounded-md border bg-muted p-4 text-xs font-mono text-muted-foreground">
            {JSON.stringify(run, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
