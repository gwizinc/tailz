import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { AppProvider } from '@/components/providers/app-provider'

import { OrgRepoDashboard } from './org-repo-dashboard'

interface OrgData {
  id: string
  slug: string
  name: string
}

interface RepoItem {
  id: string
  name: string
  defaultBranch?: string
  updatedAt?: string
}

export function OrgRepoDashboardLoader() {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [org, setOrg] = useState<OrgData | null>(null)
  const [repos, setRepos] = useState<RepoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const orgResp = await trpc.org.getDefault.query()
        const currentOrg = orgResp.org
        const reposResp = currentOrg
          ? await trpc.repo.listByOrg.query({ orgSlug: currentOrg.slug })
          : { repos: [] as RepoItem[] }

        if (!isMounted) {
          return
        }
        setOrg(currentOrg ?? null)
        setRepos(
          (reposResp.repos as Array<{ id: string; name: string; defaultBranch: string | null }>).map(
            (r) => ({ id: r.id, name: r.name, defaultBranch: r.defaultBranch ?? undefined }),
          ),
        )
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
  }, [trpc])

  return (
    <AppProvider>
      {isLoading ? (
        <LoadingProgress label="Loading organization and repositories..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : (
        <OrgRepoDashboard org={org} repos={repos} />
      )}
    </AppProvider>
  )
}
