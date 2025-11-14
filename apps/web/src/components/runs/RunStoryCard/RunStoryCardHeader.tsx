import ReactMarkdown from 'react-markdown'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDate,
  formatDurationMs,
  formatRelativeTime,
  getDisplayStatus,
  getStatusPillStyles,
  getStoryTimestamps,
} from '../utils'
import type { RunStory } from '../types'

interface RunStoryCardHeaderProps {
  story: RunStory
  orgName: string
  repoName: string
}

export function RunStoryCardHeader({
  story,
  orgName,
  repoName,
}: RunStoryCardHeaderProps) {
  const storyTitle = story.story ? story.story.name : 'Story not found'
  const {
    startedAt: startedTimestamp,
    completedAt: completedTimestamp,
    durationMs,
  } = getStoryTimestamps(story)
  const durationDisplay = formatDurationMs(durationMs)
  const startedTooltip = startedTimestamp
    ? formatDate(startedTimestamp)
    : undefined
  const completedRelative = completedTimestamp
    ? formatRelativeTime(completedTimestamp)
    : null
  const displayStatus = getDisplayStatus(story)
  const statusPill = getStatusPillStyles(displayStatus)
  const statusDescriptor = statusPill.label.toLowerCase()
  const isRunning = displayStatus === 'running'
  const timelineParts: string[] = []
  if (completedRelative && !isRunning) {
    timelineParts.push(completedRelative)
  }
  if (durationDisplay !== '—' && !isRunning) {
    timelineParts.push(`in ${durationDisplay}`)
  }
  const statusLine =
    timelineParts.length > 0
      ? `${statusDescriptor} ${timelineParts.join(' ')}`
      : statusDescriptor

  const storyUrl = `/org/${orgName}/repo/${repoName}/stories/${story.storyId}`

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="space-y-2 flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">
            {storyTitle}
          </h3>
          {!isRunning && (
            <div
              className="text-sm text-muted-foreground"
              title={startedTooltip}
            >
              {statusLine}
            </div>
          )}
          {story.summary ? (
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <ReactMarkdown>{story.summary}</ReactMarkdown>
            </div>
          ) : null}
        </div>
      </div>
      <div className="shrink-0">
        <Button variant="outline" size="sm" asChild>
          <a href={storyUrl}>
            Open story
            <ExternalLink className="ml-2 h-3 w-3" />
          </a>
        </Button>
      </div>
    </div>
  )
}

