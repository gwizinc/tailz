interface RunItem {
  id: string
  runId: string
  status: 'queued' | 'running' | 'success' | 'failed'
  createdAt: string
  commitSha: string
}

interface RunListProps {
  runs: RunItem[]
  orgSlug: string
  repoName: string
}

export function RunList({ runs, orgSlug, repoName }: RunListProps) {
  return (
    <ul className="divide-y">
      {runs.map((r) => (
        <li key={r.id} className="py-3 flex items-center justify-between">
          <a
            href={`/org/${orgSlug}/repo/${repoName}/runs/${r.runId}`}
            className="flex-1 text-foreground hover:underline"
          >
            <div className="font-medium">Run #{r.runId}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {r.createdAt} • {r.commitSha.slice(0, 7)} • {r.status}
            </div>
          </a>
        </li>
      ))}
    </ul>
  )
}
