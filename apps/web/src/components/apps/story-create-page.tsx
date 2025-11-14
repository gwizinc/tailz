import { AppProvider } from '@/components/providers/app-provider'

import { StoryLoader } from './story-loader'

export function StoryCreatePage({
  orgName,
  repoName,
}: {
  orgName: string
  repoName: string
}) {
  return (
    <AppProvider>
      <StoryLoader orgName={orgName} repoName={repoName} />
    </AppProvider>
  )
}
