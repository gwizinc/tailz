import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  orgName: string
  repoName: string
}

export function StoryList({ stories, orgName, repoName }: StoryListProps) {
  if (stories.length === 0) {
    return (
      <>
        <style>{`
          @keyframes shimmer {
            0% {
              transform: translateX(-100%);
            }
            100% {
              transform: translateX(100%);
            }
          }
          .shimmer-effect {
            animation: shimmer 3s infinite;
          }
        `}</style>
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-4"
            title="Sakusei - to create."
          >
            さくせい
          </p>
          <h2 className="text-2xl font-display text-foreground mb-3">
            Craft your first story
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            Stories encapsulate the intent of a user behavior or technical
            workflow within your product. Articulate your story in natural
            language, then Kyoto will evaluate the intent to ensure the code
            aligns with your requirements.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button asChild size="lg">
              <a href={`/org/${orgName}/repo/${repoName}/stories/new`}>
                Craft new story
                <span className="ml-2 text-xs opacity-60">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                </span>
              </a>
            </Button>
            <span className="text-xs text-muted">— or —</span>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                window.alert('Coming soon')
              }}
              className="gap-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 hover:from-primary/20 hover:via-primary/10 hover:to-primary/20 hover:border-primary/50 transition-all shadow-sm hover:shadow-md backdrop-blur-sm relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent shimmer-effect"></span>
              <Sparkles className="h-4 w-4 text-primary relative z-10" />
              <span className="relative z-10">AI Generate Story</span>
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {stories.map((story) => (
        <li key={story.id}>
          <StoryCard
            id={story.id}
            name={story.name}
            href={`/org/${orgName}/repo/${repoName}/stories/${story.id}`}
            groups={story.groups}
            latestStatus={story.latestStatus}
          />
        </li>
      ))}
    </ul>
  )
}
