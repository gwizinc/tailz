import { StoryCard } from './StoryCard'

type StoryStatus = 'pass' | 'fail' | 'error' | 'running' | null

interface StoryItem {
  id: string
  name: string
  story: string
  commitSha: string | null
  branchName: string
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
  branchName: string
}

export function StoryList({
  stories,
  orgSlug,
  repoName,
  branchName: _branchName,
}: StoryListProps) {
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
