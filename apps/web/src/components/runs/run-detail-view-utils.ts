import type {
  EvidenceConclusionDisplay,
  Run,
  RunStory,
  StatusDisplay,
  StoryAnalysis,
  StoryAnalysisEvidence,
  StoryStatusPillStatus,
} from './run-detail-view-types'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react'

export function getStatusDisplay(status: Run['status']): StatusDisplay {
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

export function getRunStatusDescriptor(status: Run['status']): string {
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
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export function formatRelativeTime(dateString: string): string {
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

export function formatDurationMs(durationMs: number | null | undefined): string {
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
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`
}

export function getConclusionStyles(
  conclusion: StoryAnalysis['conclusion'],
): {
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

export function getStatusPillStyles(status: StoryStatusPillStatus): {
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

export function getEvidenceConclusionDisplay(
  conclusion: StoryAnalysisEvidence['conclusion'],
): EvidenceConclusionDisplay {
  if (conclusion === 'pass') {
    return {
      Icon: CheckCircle2,
      iconClassName: 'text-chart-1',
      label: 'Pass',
    }
  }

  return {
    Icon: XCircle,
    iconClassName: 'text-destructive',
    label: 'Fail',
  }
}

export function formatEvidenceSummary(
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

export function getDisplayStatus(story: RunStory): StoryStatusPillStatus {
  return story.result?.status ?? story.status
}

export function getStoryTimestamps(story: RunStory) {
  const result = story.result
  return {
    startedAt: result?.startedAt ?? story.startedAt,
    completedAt: result?.completedAt ?? story.completedAt,
    durationMs:
      result?.durationMs ??
      (result?.startedAt && result?.completedAt
        ? new Date(result.completedAt).getTime() -
          new Date(result.startedAt).getTime()
        : story.startedAt && story.completedAt
          ? new Date(story.completedAt).getTime() -
            new Date(story.startedAt).getTime()
          : null),
  }
}

