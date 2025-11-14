import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ChevronDown, ClipboardCheck, FileText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TiptapEditor } from '@/components/ui/tiptap-editor'
import { StoryStatusCheck } from './StoryStatusCheck'
import {
  formatDate,
  formatDurationMs,
  formatRelativeTime,
  getConclusionStyles,
  getDisplayStatus,
  getEvidenceConclusionDisplay,
  getStatusPillStyles,
  getStoryTimestamps,
} from './run-detail-view-utils'
import type { RunStory, StoryTestResult } from './run-detail-view-types'

interface RunStoryDetailsProps {
  story: RunStory
  testResult: StoryTestResult | null
}

export function RunStoryDetails({ story, testResult }: RunStoryDetailsProps) {
  const storyTitle = story.story ? story.story.name : 'Story not found'
  const storyResult = testResult
  const analysis = storyResult?.analysis ?? null
  const scenarioText = story.story?.story ?? null
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

    const status = analysis.status
    if (status !== 'pass' && status !== 'fail' && status !== 'error') {
      // Skip rendering conclusion for 'running' or 'skipped' status
      return null
    }

    const conclusionStyles = getConclusionStyles(status)

    return (
      <div className="space-y-4">
        {status === 'fail' || status === 'error' ? (
          <div
            className={cn(
              'rounded-md border p-4 sm:p-5',
              conclusionStyles.container,
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {conclusionStyles.label}
            </p>
            <p className="mt-2 text-sm text-foreground">
              {analysis.explanation}
            </p>
          </div>
        ) : null}

        {(() => {
          // Filter out given steps - only show requirement steps
          const requirementSteps =
            analysis.steps?.filter((step) => step.type === 'requirement') ?? []

          // Don't render if there are no requirement steps
          if (requirementSteps.length === 0) {
            return null
          }

          // Group steps by goal (for requirement steps, goal is the outcome)
          const stepsByGoal = new Map<string, typeof requirementSteps>()

          requirementSteps.forEach((step) => {
            const goal = step.outcome

            if (!stepsByGoal.has(goal)) {
              stepsByGoal.set(goal, [])
            }
            stepsByGoal.get(goal)!.push(step)
          })

          return (
            <div className="space-y-4">
              {Array.from(stepsByGoal.entries()).map(([goal, steps]) => (
                <div key={goal} className="space-y-3">
                  <div className="space-y-2">
                    {steps.map((step, stepIndex) => {
                      const conclusionDisplay = getEvidenceConclusionDisplay(
                        step.conclusion === 'pass' ? 'pass' : 'fail',
                      )

                      return (
                        <details
                          key={`${storyResult.id}-step-${goal}-${stepIndex}`}
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
                              {step.outcome}
                            </span>
                          </summary>
                          <div className="space-y-3 border-t px-3 py-3 text-sm text-foreground">
                            {step.assertions && step.assertions.length > 0 ? (
                              <div className="space-y-2">
                                {step.assertions.map(
                                  (assertion, assertionIndex) => (
                                    <div
                                      key={`${storyResult.id}-assertion-${goal}-${stepIndex}-${assertionIndex}`}
                                      className="rounded-md border bg-background p-3"
                                    >
                                      <div className="text-sm font-medium text-foreground">
                                        {assertion.fact}
                                      </div>
                                      {assertion.evidence &&
                                      assertion.evidence.length > 0 ? (
                                        <div className="mt-2 space-y-1">
                                          <div className="text-xs font-medium text-muted-foreground">
                                            Evidence:
                                          </div>
                                          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                                            {assertion.evidence.map(
                                              (ev, evIndex) => (
                                                <li key={evIndex}>{ev}</li>
                                              ),
                                            )}
                                          </ul>
                                        </div>
                                      ) : null}
                                    </div>
                                  ),
                                )}
                              </div>
                            ) : null}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    )
  })()

  return (
    <Card className="border">
      <CardContent className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <StoryStatusCheck status={displayStatus} />
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
                <span className="text-sm font-medium">Composition</span>
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
            {conclusionContent}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
