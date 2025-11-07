import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { AppProvider } from '@/components/providers/app-provider'

import { RepoOverview } from './repo-overview'

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

interface RepoInfo {
  id: string
  name: string
  defaultBranch: string | null
  enabled: boolean
}

interface StoryItem {
  id: string
  name: string
  story: string
  commitSha: string | null
  branchName: string
  createdAt: string | null
  updatedAt: string | null
}

export function RepoOverviewLoader({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [runs, setRuns] = useState<RunItem[]>([])
  const [stories, setStories] = useState<StoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = async (branchName?: string) => {
    try {
      const [repoResp, branchesResp, runsResp] = await Promise.all([
        trpc.repo.getBySlug.query({ orgSlug, repoName }),
        trpc.branch.listByRepo.query({ orgSlug, repoName }),
        trpc.run.listByRepo.query({ orgSlug, repoName }),
      ])
      if (repoResp.repo) {
        setRepo(repoResp.repo)
        const defaultBranch =
          repoResp.repo.defaultBranch || branchesResp.branches[0]?.name || ''
        const branchToUse = branchName || defaultBranch

        // Load stories for the selected branch
        if (branchToUse) {
          const storiesResp = await trpc.story.listByBranch.query({
            orgSlug,
            repoName,
            branchName: branchToUse,
          })
          setStories(storiesResp.stories as StoryItem[])
        }
      }
      setBranches(branchesResp.branches)
      setRuns(runsResp.runs as RunItem[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    async function load() {
      await loadData()
      if (!isMounted) {
        return
      }
    }
    void load()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trpc, orgSlug, repoName, refreshKey])

  const handleRefreshRuns = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <AppProvider>
      {isLoading ? (
        <LoadingProgress label="Loading repository..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : (
        <RepoOverview
          orgSlug={orgSlug}
          repoName={repoName}
          defaultBranch={repo?.defaultBranch ?? null}
          branches={branches}
          runs={runs}
          stories={stories}
          onRefreshRuns={handleRefreshRuns}
        />
      )}
    </AppProvider>
  )
}
