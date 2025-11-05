import { useState } from 'react'
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

interface BranchItem {
  name: string
  headSha?: string
  updatedAt?: string
}

interface RunItem {
  id: string
  runId: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'skipped'
  createdAt: string
  updatedAt: string
  durationMs: number
  commitSha: string
  commitMessage: string | null
  branchName: string
}

interface Props {
  orgSlug: string
  repoName: string
  defaultBranch: string | null
  branches: BranchItem[]
  runs: RunItem[]
  onRefreshRuns?: () => void
}

export function RepoOverview({
  orgSlug,
  repoName,
  defaultBranch,
  branches,
  runs,
  onRefreshRuns,
}: Props) {
  const trpc = useTRPCClient()
  const [selectedBranch, setSelectedBranch] = useState<string>(
    defaultBranch || branches[0]?.name || '',
  )
  const [isCreatingRun, setIsCreatingRun] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isFindingStories, setIsFindingStories] = useState(false)
  const [findStoriesError, setFindStoriesError] = useState<string | null>(null)
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
        // Omit branchName to use default branch
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

  const handleFindStoriesInRepo = async () => {
    setIsFindingStories(true)
    setFindStoriesError(null)
    try {
      await trpc.repo.findStoriesInRepo.mutate({
        orgSlug,
        repoName,
      })
    } catch (error) {
      setFindStoriesError(
        error instanceof Error
          ? error.message
          : 'Failed to find stories in repo',
      )
    } finally {
      setIsFindingStories(false)
    }
  }

  const handleFindStoriesInCommit = async () => {
    if (!commitSha.trim()) {
      setFindStoriesError('Commit SHA is required')
      return
    }
    setIsFindingStories(true)
    setFindStoriesError(null)
    try {
      await trpc.repo.findStoriesInCommit.mutate({
        orgSlug,
        repoName,
        commitSha: commitSha.trim(),
      })
      setCommitDialogOpen(false)
      setCommitSha('')
    } catch (error) {
      setFindStoriesError(
        error instanceof Error
          ? error.message
          : 'Failed to find stories in commit',
      )
    } finally {
      setIsFindingStories(false)
    }
  }

  const handleFindStoriesInPR = async () => {
    const prNum = Number.parseInt(prNumber.trim(), 10)
    if (Number.isNaN(prNum) || prNum < 1) {
      setFindStoriesError('Valid PR number is required')
      return
    }
    setIsFindingStories(true)
    setFindStoriesError(null)
    try {
      await trpc.repo.findStoriesInPullRequest.mutate({
        orgSlug,
        repoName,
        pullNumber: prNum,
      })
      setPrDialogOpen(false)
      setPrNumber('')
    } catch (error) {
      setFindStoriesError(
        error instanceof Error ? error.message : 'Failed to find stories in PR',
      )
    } finally {
      setIsFindingStories(false)
    }
  }

  // Filter runs by selected branch
  const filteredRuns = runs.filter((run) => run.branchName === selectedBranch)

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
            {defaultBranch && (
              <Button
                onClick={handleStartRun}
                disabled={isCreatingRun}
                variant="default"
              >
                {isCreatingRun ? 'Starting...' : 'Start new run'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isFindingStories}
                  className="gap-2"
                >
                  Find stories in...
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setCommitDialogOpen(true)
                  }}
                  disabled={isFindingStories}
                >
                  Commit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setPrDialogOpen(true)
                  }}
                  disabled={isFindingStories}
                >
                  Pull Request
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleFindStoriesInRepo}
                  disabled={isFindingStories}
                >
                  Repository
                </DropdownMenuItem>
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
        {findStoriesError && (
          <div className="mb-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {findStoriesError}
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
                  disabled={isFindingStories}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCommitDialogOpen(false)
                  setCommitSha('')
                  setFindStoriesError(null)
                }}
                disabled={isFindingStories}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFindStoriesInCommit}
                disabled={isFindingStories || !commitSha.trim()}
              >
                {isFindingStories ? 'Finding...' : 'Find Stories'}
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
                  disabled={isFindingStories}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPrDialogOpen(false)
                  setPrNumber('')
                  setFindStoriesError(null)
                }}
                disabled={isFindingStories}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFindStoriesInPR}
                disabled={
                  isFindingStories ||
                  !prNumber.trim() ||
                  Number.isNaN(Number.parseInt(prNumber.trim(), 10))
                }
              >
                {isFindingStories ? 'Finding...' : 'Find Stories'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="mt-6">
          <h2 className="text-sm font-medium text-foreground mb-3">
            Latest runs
          </h2>
          <div className="border rounded-md overflow-hidden">
            <GitHubStyleRunList
              runs={filteredRuns}
              orgSlug={orgSlug}
              repoName={repoName}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
