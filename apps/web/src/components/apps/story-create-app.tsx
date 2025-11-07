import { AppProvider } from '@/components/providers/app-provider'

import { StoryCreateLoader } from './story-create-loader'

export function StoryCreateApp({
  orgSlug,
  repoName,
}: {
  orgSlug: string
  repoName: string
}) {
  return (
    <AppProvider>
      <StoryCreateLoader orgSlug={orgSlug} repoName={repoName} />
    </AppProvider>
  )
}
