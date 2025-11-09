import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { RunList } from '@/components/runs/RunList'
import { LoadingProgress } from '@/components/ui/loading-progress'

interface RunItem {
  id: string
  runId: string
  status: 'queued' | 'running' | 'success' | 'failed' | 'error'
  createdAt: string
  commitSha: string
}

export function RepoRunsLoader({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [runs, setRuns] = useState<RunItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const resp = await trpc.run.listByRepo.query({ orgSlug, repoName })
        if (!isMounted) {
          return
        }
        setRuns(resp.runs as RunItem[])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load runs')
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
    <AppLayout
      breadcrumbs={[
        { label: orgSlug, href: `/org/${orgSlug}` },
        { label: repoName, href: `/org/${orgSlug}/repo/${repoName}` },
      ]}
    >
      {isLoading ? (
        <LoadingProgress label="Loading runs..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : (
        <div className="p-6">
          <h1 className="text-xl font-semibold text-foreground">Runs</h1>
          <div className="mt-4 border rounded-md p-3">
            <RunList runs={runs} orgSlug={orgSlug} repoName={repoName} />
          </div>
        </div>
      )}
    </AppLayout>
  )
}
