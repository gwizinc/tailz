import { AppProvider } from '@/components/providers/app-provider'

import { RepoRunsLoader } from './repo-runs-loader'

export function RepoRunsApp({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  return (
    <AppProvider>
      <RepoRunsLoader orgSlug={orgSlug} repoName={repoName} />
    </AppProvider>
  )
}
