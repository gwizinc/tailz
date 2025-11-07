import { cn } from '@/lib/utils'
import { StoryStatusCheck } from './StoryStatusCheck'

interface RunStory {
  storyId: string
  resultId: string | null
  status: 'pass' | 'fail' | 'running' | 'skipped' | 'blocked'
  summary: string | null
  startedAt: string | null
  completedAt: string | null
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
  status: 'pass' | 'fail' | 'skipped' | 'running'
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

function getStatusBadgeClass(status: 'pass' | 'fail' | 'skipped' | 'running') {
  switch (status) {
    case 'pass':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    case 'fail':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'skipped':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    case 'running':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export function RunDetailView({ run, orgSlug, repoName }: RunDetailViewProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Section: Metadata */}
      <div className="p-6 border-b space-y-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Run Details</h1>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md',
              getStatusBadgeClass(run.status),
            )}
          >
            {run.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Time</div>
            <div className="text-foreground mt-1">
              {formatDate(run.createdAt)}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground">Branch</div>
            <div className="text-foreground mt-1">{run.branchName}</div>
          </div>

          <div>
            <div className="text-muted-foreground">Commit</div>
            <div className="text-foreground mt-1 font-mono text-xs">
              {run.commitSha ? run.commitSha.slice(0, 7) : '—'}
            </div>
          </div>

          {run.prNumber ? (
            <div>
              <div className="text-muted-foreground">Pull Request</div>
              <div className="text-foreground mt-1">#{run.prNumber}</div>
            </div>
          ) : null}

          {run.commitMessage ? (
            <div className="md:col-span-2">
              <div className="text-muted-foreground">Commit Message</div>
              <div className="text-foreground mt-1">{run.commitMessage}</div>
            </div>
          ) : null}

          {run.summary ? (
            <div className="md:col-span-2">
              <div className="text-muted-foreground">Summary</div>
              <div className="text-foreground mt-1">{run.summary}</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Stories Column */}
      <div className="flex-1 overflow-auto p-6">
        <h2 className="text-sm font-medium text-foreground mb-4">Stories</h2>
        {run.stories.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No stories in this run.
          </div>
        ) : (
          <ul className="divide-y">
            {run.stories.map((runStory) => (
              <li key={runStory.storyId} className="py-3">
                {runStory.story ? (
                  <a
                    href={`/org/${orgSlug}/repo/${repoName}/stories/${runStory.storyId}`}
                    className="flex items-center gap-3 text-foreground hover:underline"
                  >
                    <StoryStatusCheck status={runStory.status} />
                    <div className="flex-1">
                      <div className="font-medium">{runStory.story.name}</div>
                      {runStory.story.commitSha ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {runStory.story.commitSha.slice(0, 7)}
                        </div>
                      ) : null}
                      {runStory.summary ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {runStory.summary}
                        </div>
                      ) : null}
                    </div>
                  </a>
                ) : (
                  <div className="flex items-center gap-3">
                    <StoryStatusCheck status={runStory.status} />
                    <div className="flex-1">
                      <div className="font-medium text-muted-foreground">
                        Story not found ({runStory.storyId.slice(0, 8)}...)
                      </div>
                      {runStory.summary ? (
                        <div className="text-xs text-muted-foreground mt-1">
                          {runStory.summary}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
