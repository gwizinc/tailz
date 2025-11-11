import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  GitCommit,
  Loader2,
  MinusCircle,
  Timer,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GherkinViewer } from '@/components/gherkin/GherkinViewer'
import { StoryStatusCheck } from './StoryStatusCheck'

interface StoryAnalysisEvidence {
  step: string | null
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

function getRunStatusDescriptor(status: Run['status']): string {
  switch (status) {
    case 'pass':
      return 'passed'
    case 'fail':
      return 'failed'
    case 'skipped':
      return 'skipped'
    case 'running':
      return 'running'
    case 'error':
      return 'errored'
    default:
      return status
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

function getConclusionStyles(conclusion: StoryAnalysis['conclusion']): {
  container: string
  badge: string
  label: string
} {
  switch (conclusion) {
    case 'pass':
      return {
        container: 'border-chart-1/40 bg-chart-1/10',
        badge: 'bg-chart-1 text-background',
        label: 'Passed',
      }
    case 'fail':
      return {
        container: 'border-destructive/40 bg-destructive/10',
        badge: 'bg-destructive text-destructive-foreground',
        label: 'Failed',
      }
    case 'error':
      return {
        container: 'border-orange-500/40 bg-orange-500/10',
        badge: 'bg-orange-500 text-white',
        label: 'Error',
      }
  }
}

type StoryStatusPillStatus = RunStory['status'] | StoryResult['status']

function getStatusPillStyles(status: StoryStatusPillStatus): {
  className: string
  label: string
} {
  switch (status) {
    case 'pass':
      return {
        className: 'border-chart-1/30 bg-chart-1/10 text-chart-1',
        label: 'Passed',
      }
    case 'fail':
      return {
        className: 'border-destructive/30 bg-destructive/10 text-destructive',
        label: 'Failed',
      }
    case 'running':
      return {
        className: 'border-primary/30 bg-primary/10 text-primary',
        label: 'In Progress',
      }
    case 'skipped':
      return {
        className: 'border-border bg-muted text-muted-foreground',
        label: 'Skipped',
      }
    case 'error':
      return {
        className: 'border-orange-500/30 bg-orange-500/10 text-orange-600',
        label: 'Error',
      }
    default:
      return {
        className: 'border-border bg-muted text-muted-foreground',
        label: status,
      }
  }
}

function formatEvidenceSummary(
  note: string | null,
  fallback: string,
  maxLength = 120,
): string {
  const baseText = note?.trim() ?? ''
  if (!baseText) {
    return fallback
  }

  const condensed = baseText.replace(/\s+/g, ' ')
  if (condensed.length <= maxLength) {
    return condensed
  }

  const truncated = condensed.slice(0, maxLength).trimEnd()
  const lastSpace = truncated.lastIndexOf(' ')
  const safeSlice = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated
  return `${safeSlice.trimEnd()}…`
}

export function RunDetailView({ run, orgSlug, repoName }: RunDetailViewProps) {
  const statusDisplay = getStatusDisplay(run.status)
  const runStatusDescriptor = getRunStatusDescriptor(run.status)
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
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    () => run.stories[0]?.storyId ?? null,
  )

  const storyStatusCounts = useMemo(
    () =>
      run.stories.reduce(
        (acc, story) => {
          const status = story.result?.status ?? story.status
          if (status === 'pass') {
            acc.pass += 1
          } else if (status === 'fail') {
            acc.fail += 1
          } else if (status === 'error') {
            acc.error += 1
          }
          return acc
        },
        { pass: 0, fail: 0, error: 0 },
      ),
    [run.stories],
  )

  const selectedStory = useMemo<RunStory | null>(() => {
    if (selectedStoryId) {
      const match = run.stories.find(
        (story) => story.storyId === selectedStoryId,
      )
      if (match) {
        return match
      }
    }
    return run.stories[0] ?? null
  }, [run.stories, selectedStoryId])

  return (
    <div className="flex flex-col">
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
                  <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <Timer className="size-3.5" />
                      <span className="flex items-center gap-1">
                        {runStatusDescriptor}{' '}
                        <time dateTime={run.createdAt} title={absoluteStarted}>
                          {relativeStarted}
                        </time>
                        {durationDisplay !== '—'
                          ? ` in ${durationDisplay}`
                          : ''}
                      </span>
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
                      Committed{' '}
                      <time dateTime={run.createdAt} title={absoluteStarted}>
                        {relativeStarted}
                      </time>
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
                <div className="space-y-2 md:col-span-2">
                  <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{run.summary}</ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Stories Column */}
      <div className="p-6 space-y-6">
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {storyStatusCounts.pass} passed
            </span>
            <span className="text-muted-foreground">
              {storyStatusCounts.fail} failed
            </span>
            <span className="text-muted-foreground">
              {storyStatusCounts.error} errors
            </span>
          </div>
          {run.stories.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              No stories were evaluated in this run.
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <aside className="lg:w-72 lg:shrink-0">
                <ul className="space-y-2">
                  {run.stories.map((runStory) => {
                    const storyTitle = runStory.story
                      ? runStory.story.name
                      : 'Story not found'
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
                    const durationDisplay = formatDurationMs(durationMs)
                    const completedRelative = completedTimestamp
                      ? formatRelativeTime(completedTimestamp)
                      : runStory.status === 'running'
                        ? 'In progress'
                        : null
                    const statusPill = getStatusPillStyles(
                      storyResult ? storyResult.status : runStory.status,
                    )
                    const isSelected =
                      selectedStory?.storyId === runStory.storyId

                    return (
                      <li key={runStory.storyId}>
                        <button
                          type="button"
                          onClick={() => setSelectedStoryId(runStory.storyId)}
                          className={cn(
                            'w-full rounded-md border px-3 py-3 text-left transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary-foreground'
                              : 'border-border hover:bg-muted',
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <StoryStatusCheck status={runStory.status} />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-medium text-foreground">
                                  {storyTitle}
                                </span>
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                    statusPill.className,
                                  )}
                                >
                                  {statusPill.label}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {completedRelative
                                  ? `${completedRelative}${
                                      durationDisplay !== '—'
                                        ? ` · ${durationDisplay}`
                                        : ''
                                    }`
                                  : durationDisplay !== '—'
                                    ? `Duration ${durationDisplay}`
                                    : 'Awaiting completion'}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </aside>
              <section className="flex-1 min-w-0">
                {(() => {
                  if (!selectedStory) {
                    return (
                      <div className="rounded-md border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                        Select a story to inspect the analysis details.
                      </div>
                    )
                  }

                  const storyTitle = selectedStory.story
                    ? selectedStory.story.name
                    : 'Story not found'
                  const storyResult = selectedStory.result
                  const analysis = storyResult?.analysis ?? null
                  const scenarioText = selectedStory.story?.story ?? null
                  const startedTimestamp =
                    storyResult?.startedAt ?? selectedStory.startedAt
                  const completedTimestamp =
                    storyResult?.completedAt ?? selectedStory.completedAt
                  const durationMs =
                    storyResult?.durationMs ??
                    (startedTimestamp && completedTimestamp
                      ? new Date(completedTimestamp).getTime() -
                        new Date(startedTimestamp).getTime()
                      : null)
                  const durationDisplay = formatDurationMs(durationMs)
                  const startedTooltip = startedTimestamp
                    ? formatDate(startedTimestamp)
                    : undefined
                  const completedRelative = completedTimestamp
                    ? formatRelativeTime(completedTimestamp)
                    : selectedStory.status === 'running'
                      ? 'in progress'
                      : null
                  const statusPill = getStatusPillStyles(
                    storyResult ? storyResult.status : selectedStory.status,
                  )
                  const statusDescriptor = statusPill.label.toLowerCase()
                  const timelineParts: string[] = []
                  if (completedRelative) {
                    timelineParts.push(completedRelative)
                  }
                  if (durationDisplay !== '—') {
                    timelineParts.push(`in ${durationDisplay}`)
                  }
                  const statusLine =
                    timelineParts.length > 0
                      ? `${statusDescriptor} ${timelineParts.join(' ')}`
                      : statusDescriptor
                  const conclusionStyles = analysis
                    ? getConclusionStyles(analysis.conclusion)
                    : null

                  const conclusionContent = (() => {
                    if (!storyResult) {
                      return (
                        <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                          No evaluation result recorded for this story.
                        </div>
                      )
                    }

                    if (!analysis) {
                      return (
                        <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                          Evaluation completed without additional analysis
                          details.
                        </div>
                      )
                    }

                    const resolvedConclusionStyles = conclusionStyles ?? {
                      container: 'border-border bg-muted/40',
                      badge: 'bg-muted text-foreground',
                      label: analysis.conclusion,
                    }

                    return (
                      <div className="space-y-4">
                        <div
                          className={cn(
                            'rounded-md border p-4 sm:p-5',
                            resolvedConclusionStyles.container,
                          )}
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {resolvedConclusionStyles.label}
                          </p>
                          <p className="mt-2 text-sm text-foreground">
                            {analysis.explanation}
                          </p>
                        </div>

                        {analysis.evidence.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Evidence
                            </div>
                            <div className="space-y-2">
                              {analysis.evidence.map((evidence, index) => {
                                const summaryTitle =
                                  evidence.step?.trim() &&
                                  evidence.step.trim().length > 0
                                    ? evidence.step.trim()
                                    : formatEvidenceSummary(
                                        evidence.note,
                                        evidence.filePath,
                                      )

                                const lineInfo =
                                  evidence.startLine && evidence.endLine
                                    ? `L${evidence.startLine}-L${evidence.endLine}`
                                    : evidence.startLine
                                      ? `L${evidence.startLine}`
                                      : null

                                return (
                                  <details
                                    key={`${storyResult.id}-evidence-${index}`}
                                    className="group rounded-md border bg-muted/40 text-sm text-foreground"
                                  >
                                    <summary className="flex w-full cursor-pointer select-none items-center gap-3 px-3 py-3 text-left [&::-webkit-details-marker]:hidden">
                                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                                      <div className="space-y-1">
                                        <span className="block font-medium">
                                          {summaryTitle}
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                          {evidence.filePath}
                                          {lineInfo ? ` · ${lineInfo}` : ''}
                                        </span>
                                      </div>
                                    </summary>
                                    <div className="space-y-4 border-t px-3 py-3 text-sm text-foreground">
                                      <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2 rounded-md border bg-background p-3">
                                          {evidence.note ? (
                                            <div className="prose prose-sm max-w-none text-foreground">
                                              <ReactMarkdown>
                                                {evidence.note}
                                              </ReactMarkdown>
                                            </div>
                                          ) : (
                                            <div className="text-sm text-muted-foreground">
                                              No summary provided.
                                            </div>
                                          )}
                                        </div>
                                        <div className="space-y-2 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Related Code
                                          </div>
                                          <p>Code preview coming soon.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </details>
                                )
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })()

                  return (
                    <Card className="border">
                      <CardContent className="space-y-6 p-4 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <StoryStatusCheck status={selectedStory.status} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-foreground">
                                {storyTitle}
                              </h3>
                              <div
                                className="text-sm text-muted-foreground"
                                title={startedTooltip}
                              >
                                {statusLine}
                              </div>
                              {selectedStory.summary ? (
                                <div className="prose prose-sm max-w-none text-muted-foreground">
                                  <ReactMarkdown>
                                    {selectedStory.summary}
                                  </ReactMarkdown>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-start justify-end gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                                statusPill.className,
                              )}
                            >
                              {statusPill.label}
                            </span>
                            {storyResult ? (
                              <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                                Analysis v{storyResult.analysisVersion}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {scenarioText ? (
                          <div className="space-y-2">
                            <GherkinViewer text={scenarioText} />
                          </div>
                        ) : null}

                        {conclusionContent}
                      </CardContent>
                    </Card>
                  )
                })()}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
