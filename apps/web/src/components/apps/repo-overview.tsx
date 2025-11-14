import { useEffect, useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@app/api'
import { SiGithub } from 'react-icons/si'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { RunList } from '@/components/runs/RunList'
import { StoryList } from '@/components/stories/StoryList'

type RouterOutputs = inferRouterOutputs<AppRouter>
type RunItem = RouterOutputs['run']['listByRepo']['runs'][number]
type StoryItem = RouterOutputs['story']['listByRepo']['stories'][number]

interface Props {
  orgName: string
  repoName: string
  defaultBranch: string | null
  runs: RunItem[]
  stories: StoryItem[]
  onRefreshRuns?: () => void
}

export function RepoOverview({
  orgName,
  repoName,
  defaultBranch,
  runs,
  stories,
  onRefreshRuns,
}: Props) {
  const trpc = useTRPCClient()
  const [isCreatingRun, setIsCreatingRun] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.includes('Mac')
      const modifierKey = isMac ? event.metaKey : event.ctrlKey

      if (modifierKey && event.key === 'Enter') {
        event.preventDefault()
        window.location.href = `/org/${orgName}/repo/${repoName}/stories/new`
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [orgName, repoName])

  const handleStartRun = async () => {
    if (!defaultBranch) {
      return
    }
    setIsCreatingRun(true)
    setCreateError(null)
    try {
      await trpc.run.create.mutate({
        orgName,
        repoName,
      })
      // Refresh runs list after successful creation
      if (onRefreshRuns) {
        onRefreshRuns()
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Failed to start run',
      )
    } finally {
      setIsCreatingRun(false)
    }
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: orgName, href: `/org/${orgName}` },
        { label: repoName, href: `/org/${orgName}/repo/${repoName}` },
      ]}
    >
      <div className="p-6 flex flex-col h-full overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <a
              href={`https://github.com/${orgName}/${repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70 transition-opacity"
              aria-label="View repository on GitHub"
            >
              <SiGithub className="h-5 w-5" />
            </a>
            <span>{repoName}</span>
          </h1>
          <div className="flex items-center gap-3" />
        </div>
        {createError && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {createError}
          </div>
        )}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Panel: Stories */}
          <div>
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                  {stories.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {stories.length} stories
                    </span>
                  )}
                </div>
                {stories.length > 0 && (
                  <Button asChild variant="outline" size="sm">
                    <a href={`/org/${orgName}/repo/${repoName}/stories/new`}>
                      Craft new story
                    </a>
                  </Button>
                )}
              </div>
              <div className="max-h-[600px] overflow-auto">
                <StoryList
                  stories={stories}
                  orgName={orgName}
                  repoName={repoName}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Runs */}
          <div>
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                  {runs.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {runs.length} intent testing runs
                    </span>
                  )}
                </div>
                {defaultBranch && stories.length > 0 && (
                  <Button
                    disabled={isCreatingRun}
                    variant="default"
                    size="sm"
                    onClick={handleStartRun}
                  >
                    {isCreatingRun ? 'Starting...' : 'Begin new run'}
                  </Button>
                )}
              </div>
              <RunList runs={runs} orgName={orgName} repoName={repoName} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
