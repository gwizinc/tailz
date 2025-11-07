import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { RunDetailView } from '@/components/runs/RunDetailView'

interface RunStory {
  storyId: string
  resultId: string | null
  status: 'pass' | 'fail' | 'running' | 'skipped' | 'blocked'
  summary: string | null
  startedAt: string | null
  completedAt: string | null
  story: {
    id: string
    name: string
    story: string
    branchName: string
    commitSha: string | null
    createdAt: string
    updatedAt: string
  } | null
}

interface Run {
  id: string
  commitSha: string | null
  branchName: string
  commitMessage: string | null
  prNumber: string | null
  status: 'pass' | 'fail' | 'skipped' | 'running'
  summary: string | null
  createdAt: string
  updatedAt: string
  stories: RunStory[]
}

export function RunDetailLoader({
  orgSlug,
  repoName,
  runId,
}: {
  orgSlug: string
  repoName: string
  runId: string
}) {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const resp = await trpc.run.getByRunId.query({
          orgSlug,
          repoName,
          runId,
        })
        if (!isMounted) {
          return
        }
        if (!resp.run) {
          setError('Run not found')
          return
        }
        setRun(resp.run)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load run')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [trpc, orgSlug, repoName, runId])

  return (
    <AppLayout
      breadcrumbs={[
        { label: orgSlug, href: `/org/${orgSlug}`, showGithubIcon: true },
        { label: repoName, href: `/org/${orgSlug}/repo/${repoName}` },
        { label: 'Runs', href: `/org/${orgSlug}/repo/${repoName}/runs` },
      ]}
    >
      {isLoading ? (
        <LoadingProgress label="Loading run..." />
      ) : error ? (
        <div className="p-6 text-sm text-red-500">{error}</div>
      ) : run ? (
        <RunDetailView run={run} orgSlug={orgSlug} repoName={repoName} />
      ) : null}
    </AppLayout>
  )
}
