import { AppProvider } from '@/components/providers/app-provider'

import { StoryLoader } from './story-loader'

export function StoryPage({
  orgName,
  repoName,
  storyId,
}: {
  orgName: string
  repoName: string
  storyId: string
}) {
  return (
    <AppProvider>
      <StoryLoader orgName={orgName} repoName={repoName} storyId={storyId} />
    </AppProvider>
  )
}
