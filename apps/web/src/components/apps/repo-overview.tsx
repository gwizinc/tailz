import { useState, useEffect } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@app/api'
import { ChevronDown, GitBranch } from 'lucide-react'
import { SiGithub } from 'react-icons/si'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [isIndexingRepo] = useState(false)
  const [indexRepoError, setIndexRepoError] = useState<string | null>(null)
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [prDialogOpen, setPrDialogOpen] = useState(false)
  const [commitSha, setCommitSha] = useState('')
  const [prNumber, setPrNumber] = useState('')

  const handleStartRun = async () => {
    if (!defaultBranch) {
      return
    }
    setIsCreatingRun(true)
    setCreateError(null)
    try {
      await trpc.run.create.mutate({
        orgSlug,
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

  const handleFindStoriesInCommit = () => {
    if (!commitSha.trim()) {
      setIndexRepoError('Commit SHA is required')
      return
    }
    setIndexRepoError('Finding stories by commit is not available yet')
  }

  const handleFindStoriesInPR = () => {
    const prNum = Number.parseInt(prNumber.trim(), 10)
    if (Number.isNaN(prNum) || prNum < 1) {
      setIndexRepoError('Valid PR number is required')
      return
    }
    setIndexRepoError('Finding stories by pull request is not available yet')
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
            <SiGithub className="h-5 w-5" />
            <span>
              {orgSlug}/{repoName}
            </span>
          </h1>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled className="gap-2">
                  Find stories in...
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setCommitDialogOpen(true)
                  }}
                  disabled
                >
                  Commit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setPrDialogOpen(true)
                  }}
                  disabled
                >
                  Pull Request
                </DropdownMenuItem>
                <DropdownMenuItem disabled>Repository</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
        {indexRepoError && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {indexRepoError}
          </div>
        )}

        <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Find Stories in Commit</DialogTitle>
              <DialogDescription>
                Enter the commit SHA to find stories in that commit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="commitSha">Commit SHA</Label>
                <Input
                  id="commitSha"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  placeholder="e.g., abc123def456..."
                  disabled
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCommitDialogOpen(false)
                  setCommitSha('')
                  setIndexRepoError(null)
                }}
                disabled
              >
                Cancel
              </Button>
              <Button onClick={handleFindStoriesInCommit} disabled>
                {isIndexingRepo ? 'Finding...' : 'Find Stories'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={prDialogOpen} onOpenChange={setPrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Find Stories in Pull Request</DialogTitle>
              <DialogDescription>
                Enter the pull request number to find stories in that PR.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="prNumber">PR Number</Label>
                <Input
                  id="prNumber"
                  type="number"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  placeholder="e.g., 123"
                  disabled
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPrDialogOpen(false)
                  setPrNumber('')
                  setIndexRepoError(null)
                }}
                disabled
              >
                Cancel
              </Button>
              <Button
                onClick={handleFindStoriesInPR}
                disabled={
                  isIndexingRepo ||
                  !prNumber.trim() ||
                  Number.isNaN(Number.parseInt(prNumber.trim(), 10))
                }
              >
                {isIndexingRepo ? 'Finding...' : 'Find Stories'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Panel: Stories */}
          <div>
            <div className="border rounded-md overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-4 py-2 border-b">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-medium text-foreground">
                    Stories
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {filteredStories.length} total
                  </span>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/org/${orgSlug}/repo/${repoName}/stories/new?branch=${encodeURIComponent(selectedBranch)}`}
                  >
                    Add new story
                  </a>
                </Button>
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
                  <h2 className="text-sm font-medium text-foreground">
                    Latest runs
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {filteredRuns.length} total
                  </span>
                </div>
                {defaultBranch && (
                  <Button
                    onClick={handleStartRun}
                    disabled={isCreatingRun}
                    variant="default"
                    size="sm"
                  >
                    {isCreatingRun ? 'Starting...' : 'Start new run'}
                  </Button>
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
