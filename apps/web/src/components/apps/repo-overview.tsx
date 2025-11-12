import { useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@app/api'
import { SiGithub } from 'react-icons/si'
import { LuOrigami } from 'react-icons/lu'
import { CiBoxList } from 'react-icons/ci'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { GitHubStyleRunList } from '@/components/runs/GitHubStyleRunList'
import { StoryList } from '@/components/stories/StoryList'

type RouterOutputs = inferRouterOutputs<AppRouter>
type RunItem = RouterOutputs['run']['listByRepo']['runs'][number]
type StoryItem = RouterOutputs['story']['listByRepo']['stories'][number]

interface Props {
  orgSlug: string
  repoName: string
  defaultBranch: string | null
  runs: RunItem[]
  stories: StoryItem[]
  onRefreshRuns?: () => void
}

export function RepoOverview({
  orgSlug,
  repoName,
  defaultBranch,
  runs,
  stories,
  onRefreshRuns,
}: Props) {
  const trpc = useTRPCClient()
  const [isCreatingRun, setIsCreatingRun] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleStartRun = async () => {
    const agentVersion: 'v1' | 'v2' = 'v2'
    if (!defaultBranch) {
      return
    }
    setIsCreatingRun(true)
    setCreateError(null)
    try {
      await trpc.run.create.mutate({
        orgSlug,
        repoName,
        agentVersion,
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
        { label: orgSlug, href: `/org/${orgSlug}` },
        { label: repoName, href: `/org/${orgSlug}/repo/${repoName}` },
      ]}
    >
      <div className="p-6 flex flex-col h-full overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <a
              href={`https://github.com/${orgSlug}/${repoName}`}
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
                  <LuOrigami
                    aria-hidden="true"
                    className="h-5 w-5 text-muted-foreground"
                  />
                  <h2 className="text-base font-semibold text-foreground">
                    Stories
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {stories.length} total
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/org/${orgSlug}/repo/${repoName}/stories/new`}>
                      Add new story
                    </a>
                  </Button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-auto">
                <StoryList
                  stories={stories}
                  orgSlug={orgSlug}
                  repoName={repoName}
                />
              </div>
            </div>
          </div>

          {/* Right Panel: Runs */}
          <div>
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
                <div className="flex items-baseline gap-2">
                  <div className="flex items-center gap-2">
                    <CiBoxList
                      className="h-5 w-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <h2 className="text-base font-semibold text-foreground">
                      Intent Test Runs
                    </h2>
                  </div>
                </div>
                {defaultBranch && (
                  <Button
                    disabled={isCreatingRun}
                    variant="default"
                    size="sm"
                    onClick={handleStartRun}
                  >
                    {isCreatingRun ? 'Starting...' : 'Start new run'}
                  </Button>
                )}
              </div>
              <GitHubStyleRunList
                runs={runs}
                orgSlug={orgSlug}
                repoName={repoName}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
