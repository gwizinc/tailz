import { useCallback, useEffect, useState } from 'react'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@app/api'

import { useTRPCClient } from '@/client/trpc'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { AppProvider } from '@/components/providers/app-provider'

import { RepoOverview } from './repo-overview'

type RouterOutputs = inferRouterOutputs<AppRouter>
type RepoDetailsOutput = RouterOutputs['repo']['getBySlug']
type BranchesOutput = RouterOutputs['branch']['listByRepo']
type RunsOutput = RouterOutputs['run']['listByRepo']
type StoriesOutput = RouterOutputs['story']['listByBranch']

type RepoInfo = RepoDetailsOutput['repo']
type BranchItem = BranchesOutput['branches'][number]
type RunItem = RunsOutput['runs'][number]
type StoryItem = StoriesOutput['stories'][number]

export function RepoOverviewLoader({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [repo, setRepo] = useState<RepoInfo>(null)
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [runs, setRuns] = useState<RunItem[]>([])
  const [stories, setStories] = useState<StoryItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(
    async (branchName?: string) => {
      setIsLoading(true)
      try {
        const [repoResp, branchesResp, runsResp] = await Promise.all([
          trpc.repo.getBySlug.query({ orgSlug, repoName }),
          trpc.branch.listByRepo.query({ orgSlug, repoName }),
          trpc.run.listByRepo.query({ orgSlug, repoName }),
        ])

        if (repoResp.repo) {
          setRepo(repoResp.repo)
          const defaultBranch =
            repoResp.repo.defaultBranch ?? branchesResp.branches[0]?.name ?? ''
          const branchToUse = branchName ?? defaultBranch

          if (branchToUse) {
            const storiesResp = await trpc.story.listByBranch.query({
              orgSlug,
              repoName,
              branchName: branchToUse,
            })
            setStories(storiesResp.stories)
          } else {
            setStories([])
          }
        } else {
          setRepo(null)
          setStories([])
        }

        setBranches(branchesResp.branches)
        setRuns(runsResp.runs)
        setError(null)
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    },
    [trpc, orgSlug, repoName],
  )

  useEffect(() => {
    void loadData()
  }, [loadData, refreshKey])

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
