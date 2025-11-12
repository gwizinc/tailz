import { StoryCard } from './StoryCard'

type StoryStatus = 'pass' | 'fail' | 'error' | 'running' | null

interface StoryItem {
  id: string
  name: string
  story: string
  createdAt: string | null
  updatedAt: string | null
  groups: string[]
  latestStatus: StoryStatus
  latestStatusAt: string | null
}

interface StoryListProps {
  stories: StoryItem[]
  orgSlug: string
  repoName: string
}

export function StoryList({ stories, orgSlug, repoName }: StoryListProps) {
  if (stories.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        No stories yet. Create one to get started. (Soon we will generate some
        for you automatically.)
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {stories.map((story) => (
        <li key={story.id}>
          <StoryCard
            id={story.id}
            name={story.name}
            href={`/org/${orgSlug}/repo/${repoName}/stories/${story.id}`}
            groups={story.groups}
            latestStatus={story.latestStatus}
          />
        </li>
      ))}
    </ul>
  )
}
