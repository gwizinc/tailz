import { useState } from 'react'

import { AppLayout } from '@/components/layout'
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
}

export function RepoOverview({
  orgSlug,
  repoName,
  defaultBranch,
  branches,
  runs,
}: Props) {
  const [selectedBranch, setSelectedBranch] = useState<string>(
    defaultBranch || branches[0]?.name || '',
  )

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
          <h1 className="text-xl font-semibold text-foreground">
            {orgSlug}/{repoName}
          </h1>
          {branches.length > 0 && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select branch" />
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
