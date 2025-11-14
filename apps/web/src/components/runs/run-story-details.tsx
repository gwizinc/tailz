import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChevronDown, ClipboardCheck, FileJson, FileText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { StoryStatusCheck } from './StoryStatusCheck'
import {
  formatDate,
  formatDurationMs,
  formatEvidenceSummary,
  formatRelativeTime,
  getConclusionStyles,
  getDisplayStatus,
  getEvidenceConclusionDisplay,
  getStatusPillStyles,
  getStoryTimestamps,
} from './run-detail-view-utils'
import type { RunStory } from './run-detail-view-types'

interface RunStoryDetailsProps {
  story: RunStory
}

export function RunStoryDetails({ story }: RunStoryDetailsProps) {
  const storyTitle = story.story ? story.story.name : 'Story not found'
  const storyResult = story.result
  const analysis = storyResult?.analysis ?? null
  const scenarioText = story.story?.story ?? null
  const decomposition = story.story?.decomposition ?? null
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
  const statusPill = getStatusPillStyles(getDisplayStatus(story))
  const statusDescriptor = statusPill.label.toLowerCase()
  const isRunning = story.status === 'running'
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

  const conclusionContent = (() => {
    if (!storyResult) {
      return null
    }

    if (!analysis) {
      return (
        <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Evaluation completed without additional analysis details.
        </div>
      )
    }

    const conclusionStyles = getConclusionStyles(analysis.conclusion)

    return (
      <div className="space-y-4">
        <div
          className={cn(
            'rounded-md border p-4 sm:p-5',
            conclusionStyles.container,
          )}
        >
          <p className="text-sm font-semibold text-foreground">
            {conclusionStyles.label}
          </p>
          <p className="mt-2 text-sm text-foreground">{analysis.explanation}</p>
        </div>

        {analysis.evidence.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Evidence
            </div>
            <div className="space-y-2">
              {analysis.evidence.map((evidence, index) => {
                const summaryTitle =
                  evidence.step?.trim() && evidence.step.trim().length > 0
                    ? evidence.step.trim()
                    : formatEvidenceSummary(evidence.note, evidence.filePath)

                const lineInfo =
                  evidence.startLine && evidence.endLine
                    ? `L${evidence.startLine}-L${evidence.endLine}`
                    : evidence.startLine
                      ? `L${evidence.startLine}`
                      : null
                const conclusionDisplay = getEvidenceConclusionDisplay(
                  evidence.conclusion,
                )

                return (
                  <details
                    key={`${storyResult.id}-evidence-${index}`}
                    className="group rounded-md border bg-muted/40 text-sm text-foreground"
                  >
                    <summary className="flex w-full cursor-pointer select-none items-center gap-2 px-3 py-3 text-left [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                      <conclusionDisplay.Icon
                        aria-label={conclusionDisplay.label}
                        className={cn(
                          'size-4 shrink-0',
                          conclusionDisplay.iconClassName,
                        )}
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {summaryTitle}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t px-3 py-3 text-sm text-foreground">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px]">
                          {evidence.filePath}
                        </code>
                        {lineInfo ? <span>{lineInfo}</span> : null}
                      </div>
                      {evidence.note ? (
                        <div className="prose prose-sm max-w-none text-foreground">
                          <ReactMarkdown>{evidence.note}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No conclusion note provided.
                        </div>
                      )}
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
            <StoryStatusCheck status={story.status} />
            <div className="space-y-2">
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
        </div>

        <Tabs defaultValue="story" className="w-full">
          <div className="flex items-center justify-center mb-4">
            <TabsList className="h-auto p-1">
              <TabsTrigger
                value="story"
                className="flex flex-row items-center gap-1.5 h-auto px-3 py-2 data-[state=active]:bg-background"
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Story</span>
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="flex flex-row items-center gap-1.5 h-auto px-3 py-2 data-[state=active]:bg-background"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Analysis</span>
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="flex flex-row items-center gap-1.5 h-auto px-3 py-2 data-[state=active]:bg-background"
              >
                <FileJson className="h-4 w-4" />
                <span className="text-sm font-medium">Results</span>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="story" className="mt-0 space-y-2" tabIndex={-1}>
            {scenarioText ? (
              <TiptapEditor
                value={scenarioText}
                onChange={() => {}}
                readOnly={true}
              />
            ) : (
              <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                No story content available.
              </div>
            )}
          </TabsContent>
          <TabsContent
            value="analysis"
            className="mt-0 space-y-4"
            tabIndex={-1}
          >
            {decomposition ? (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Decomposition
                </div>
                <pre className="rounded-md bg-background text-foreground p-4 overflow-auto text-sm leading-6 whitespace-pre-wrap border">
                  {JSON.stringify(decomposition, null, 2)}
                </pre>
              </div>
            ) : null}
            {conclusionContent}
          </TabsContent>
          <TabsContent value="results" className="mt-0" tabIndex={-1}>
            {storyResult ? (
              <pre className="rounded-md bg-background text-foreground p-4 overflow-auto text-sm leading-6 whitespace-pre-wrap border">
                {JSON.stringify(storyResult, null, 2)}
              </pre>
            ) : (
              <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                No results available for this story.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
