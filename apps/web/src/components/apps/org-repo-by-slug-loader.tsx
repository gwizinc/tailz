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
  isPrivate: boolean
  storyCount: number
  lastRunStatus: 'pass' | 'fail' | 'skipped' | 'running' | 'error' | null
  lastRunAt: Date | null
}

export function OrgRepoBySlugLoader({ orgSlug }: { orgSlug: string }) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [org, setOrg] = useState<OrgData | null>(null)
  const [repos, setRepos] = useState<RepoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        // When using slug, we can derive org minimal data from slug
        const reposResp = await trpc.repo.listByOrg.query({ orgSlug })
        if (!isMounted) {
          return
        }
        if (reposResp.owner) {
          setOrg({
            id: reposResp.owner.id,
            slug: reposResp.owner.slug,
            name: reposResp.owner.name,
          })
        } else {
          setOrg({ id: orgSlug, slug: orgSlug, name: orgSlug })
        }
        setRepos(
          (
            reposResp.repos as Array<{
              id: string
              name: string
              defaultBranch: string | null
              enabled: boolean
              isPrivate: boolean
              storyCount: number
              lastRunStatus:
                | 'pass'
                | 'fail'
                | 'skipped'
                | 'running'
                | 'error'
                | null
              lastRunAt: Date | null
            }>
          )
            .filter((r) => r.enabled)
            .map((r) => ({
              id: r.id,
              name: r.name,
              defaultBranch: r.defaultBranch ?? undefined,
              isPrivate: r.isPrivate,
              storyCount: r.storyCount,
              lastRunStatus: r.lastRunStatus,
              lastRunAt: r.lastRunAt,
            })),
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
  }, [trpc, orgSlug])

  return (
    <AppProvider>
      {isLoading ? (
        <LoadingProgress label="Loading organization..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : (
        <OrgRepoDashboard org={org} repos={repos} />
      )}
    </AppProvider>
  )
}
