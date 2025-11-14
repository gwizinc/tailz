import ReactMarkdown from 'react-markdown'
import { Card, CardContent } from '@/components/ui/card'
import { GitBranch, GitCommit } from 'lucide-react'
import type { Run } from './run-detail-view-types'

interface RunCommitBlockProps {
  run: Run
  relativeStarted: string
  absoluteStarted: string
  shortSha: string | null
  commitUrl: string | null
  pullRequestUrl: string | null
}

export function RunCommitBlock({
  run,
  relativeStarted,
  absoluteStarted,
  shortSha,
  commitUrl,
  pullRequestUrl,
}: RunCommitBlockProps) {
  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardContent className="grid gap-4 px-6 py-0 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex items-center gap-3">
            <div className="space-y-0.5 text-sm">
              <div className="text-xs text-muted-foreground">
                Committed{' '}
                <time dateTime={run.createdAt} title={absoluteStarted}>
                  {relativeStarted}
                </time>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end lg:justify-center">
            <GitBranch className="size-4 text-muted-foreground" />
            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-mono font-medium text-blue-800">
              {run.branchName}
            </span>
            <GitCommit className="size-4 text-muted-foreground" />
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs font-medium text-primary underline hover:text-primary/80"
              >
                {shortSha ?? '—'}
              </a>
            ) : (
              <span className="font-mono text-xs font-medium text-foreground underline">
                {shortSha ?? '—'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 text-sm sm:grid-cols-2">
        {run.prNumber ? (
          <div className="space-y-1">
            <div className="text-muted-foreground">Pull request</div>
            <div className="text-foreground font-medium">
              {pullRequestUrl ? (
                <a
                  href={pullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  #{run.prNumber}
                </a>
              ) : (
                `#${run.prNumber}`
              )}
            </div>
          </div>
        ) : null}
        {run.summary ? (
          <div className="space-y-2 md:col-span-2">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{run.summary}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
