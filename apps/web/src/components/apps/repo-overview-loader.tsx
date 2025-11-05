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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const [repoResp, branchesResp, runsResp] = await Promise.all([
          trpc.repo.getBySlug.query({ orgSlug, repoName }),
          trpc.branch.listByRepo.query({ orgSlug, repoName }),
          trpc.run.listByRepo.query({ orgSlug, repoName }),
        ])
        if (!isMounted) {
          return
        }
        if (repoResp.repo) {
          setRepo(repoResp.repo)
        }
        setBranches(branchesResp.branches)
        setRuns(runsResp.runs)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [trpc, orgSlug, repoName])

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
        />
      )}
    </AppProvider>
  )
}
