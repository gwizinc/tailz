import { useMemo, useState } from 'react'
import {
  formatDate,
  formatDurationMs,
  formatRelativeTime,
  getCommitTitle,
  getDisplayStatus,
  getRunStatusDescriptor,
  getShortSha,
  getStatusDisplay,
} from './run-detail-view-utils'
import type {
  RunDetailViewProps,
  RunStory,
  StoryStatusPillStatus,
} from './run-detail-view-types'
import { RunTitleSection } from './run-title-section'
import { RunCommitBlock } from './run-commit-block'
import { RunStoryList } from './run-story-list'
import { RunStoryDetails } from './run-story-details'

export function RunDetailView({ run, orgName, repoName }: RunDetailViewProps) {
  const statusDisplay = getStatusDisplay(run.status)
  const runStatusDescriptor = getRunStatusDescriptor(run.status)
  const commitTitle = getCommitTitle(run.commitMessage, 'Workflow run')
  const shortSha = getShortSha(run.commitSha)
  const relativeStarted = formatRelativeTime(run.createdAt)
  const absoluteStarted = formatDate(run.createdAt)
  const durationMs =
    new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime()
  const durationDisplay = formatDurationMs(
    Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null,
  )
  const commitUrl =
    run.commitSha && orgName && repoName
      ? `https://github.com/${orgName}/${repoName}/commit/${run.commitSha}`
      : null
  const pullRequestUrl =
    run.prNumber && orgName && repoName
      ? `https://github.com/${orgName}/${repoName}/pull/${run.prNumber}`
      : null

  const sortedStories = useMemo(() => {
    const statusPriority: Record<StoryStatusPillStatus, number> = {
      fail: 0,
      error: 1,
      running: 2,
      pass: 3,
      skipped: 4,
    }

    return [...run.stories].sort((a, b) => {
      const statusA = statusPriority[getDisplayStatus(a)] ?? 99
      const statusB = statusPriority[getDisplayStatus(b)] ?? 99

      if (statusA !== statusB) {
        return statusA - statusB
      }

      return run.stories.indexOf(a) - run.stories.indexOf(b)
    })
  }, [run.stories])
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(
    () => sortedStories[0]?.storyId ?? null,
  )

  const storyStatusCounts = useMemo(
    () =>
      run.stories.reduce(
        (acc, story) => {
          const status = getDisplayStatus(story)
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
      const match = sortedStories.find(
        (story) => story.storyId === selectedStoryId,
      )
      if (match) {
        return match
      }
    }
    return sortedStories[0] ?? null
  }, [sortedStories, selectedStoryId])

  return (
    <div className="flex flex-col">
      {/* Top Section: Metadata */}
      <div className="border-b bg-muted/30">
        <div className="p-6 space-y-6">
          <RunTitleSection
            commitTitle={commitTitle}
            runStatusDescriptor={runStatusDescriptor}
            relativeStarted={relativeStarted}
            absoluteStarted={absoluteStarted}
            durationDisplay={durationDisplay}
            statusDisplay={statusDisplay}
          />

          <RunCommitBlock
            run={run}
            relativeStarted={relativeStarted}
            absoluteStarted={absoluteStarted}
            shortSha={shortSha}
            commitUrl={commitUrl}
            pullRequestUrl={pullRequestUrl}
          />
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
                <RunStoryList
                  stories={sortedStories}
                  selectedStoryId={selectedStory?.storyId ?? null}
                  onStorySelect={setSelectedStoryId}
                />
              </aside>
              <section className="flex-1 min-w-0">
                {selectedStory ? (
                  <RunStoryDetails
                    story={selectedStory}
                    testResult={selectedStory.testResult}
                  />
                ) : (
                  <div className="rounded-md border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
                    Select a story to inspect the analysis details.
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
