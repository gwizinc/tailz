import { AppProvider } from '@/components/providers/app-provider'

import { RepoStoriesLoader } from './repo-stories-loader'

export function RepoStoriesApp({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  return (
    <AppProvider>
      <RepoStoriesLoader orgSlug={orgSlug} repoName={repoName} />
    </AppProvider>
  )
}
