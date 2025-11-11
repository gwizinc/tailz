import { useState, useEffect } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@app/api'
import { GitBranch } from 'lucide-react'
import { SiGithub } from 'react-icons/si'
import { LuOrigami } from 'react-icons/lu'
import { CiBoxList } from 'react-icons/ci'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GitHubStyleRunList } from '@/components/runs/GitHubStyleRunList'
import { StoryList } from '@/components/stories/StoryList'

type RouterOutputs = inferRouterOutputs<AppRouter>
type BranchItem = RouterOutputs['branch']['listByRepo']['branches'][number]
type RunItem = RouterOutputs['run']['listByRepo']['runs'][number]
type StoryItem = RouterOutputs['story']['listByBranch']['stories'][number]

interface Props {
  orgSlug: string
  repoName: string
  defaultBranch: string | null
  branches: BranchItem[]
  runs: RunItem[]
  stories: StoryItem[]
  onRefreshRuns?: () => void
}

export function RepoOverview({
  orgSlug,
  repoName,
  defaultBranch,
  branches,
  runs,
  stories: initialStories,
  onRefreshRuns,
}: Props) {
  const trpc = useTRPCClient()
  const [selectedBranch, setSelectedBranch] = useState<string>(
    defaultBranch || branches[0]?.name || '',
  )
  const [stories, setStories] = useState(initialStories)

  // Reload stories when branch changes
  useEffect(() => {
    if (!selectedBranch) {
      return
    }

    let isMounted = true
    async function loadStories() {
      try {
        const storiesResp = await trpc.story.listByBranch.query({
          orgSlug,
          repoName,
          branchName: selectedBranch,
        })
        if (isMounted) {
          setStories(storiesResp.stories)
        }
      } catch (_e) {
        // Silently fail - stories might not exist for this branch
        if (isMounted) {
          setStories([])
        }
      }
    }
    void loadStories()
    return () => {
      isMounted = false
    }
  }, [trpc, orgSlug, repoName, selectedBranch])
  const [isCreatingRun, setIsCreatingRun] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleStartRun = async (agentVersion: 'v1' | 'v2') => {
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

  // Filter runs and stories by selected branch
  const filteredRuns = runs.filter((run) => run.branchName === selectedBranch)
  const filteredStories = stories.filter(
    (story) => story.branchName === selectedBranch,
  )

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
          <div className="flex items-center gap-3">
            {branches.length > 0 && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GitBranch className="h-4 w-4 shrink-0" />
                    <SelectValue placeholder="Select branch" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
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
                    {filteredStories.length} total
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/org/${orgSlug}/repo/${repoName}/stories/new?branch=${encodeURIComponent(selectedBranch)}`}
                    >
                      Add new story
                    </a>
                  </Button>
                </div>
              </div>
              <div className="max-h-[600px] overflow-auto">
                <StoryList
                  stories={filteredStories}
                  orgSlug={orgSlug}
                  repoName={repoName}
                  branchName={selectedBranch}
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
                      Trace Evaluations
                    </h2>
                  </div>
                </div>
                {defaultBranch && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={isCreatingRun}
                        variant="default"
                        size="sm"
                      >
                        {isCreatingRun ? 'Starting...' : 'Start new run'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStartRun('v1')}
                        disabled={isCreatingRun}
                      >
                        Run with Agent v1
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStartRun('v2')}
                        disabled={isCreatingRun}
                      >
                        Run with Agent v2
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <GitHubStyleRunList
                runs={filteredRuns}
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
