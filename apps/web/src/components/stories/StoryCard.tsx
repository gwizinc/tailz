import { useMemo } from 'react'

interface StoryCardProps {
  id: string
  name: string
  story: string
  href: string
}

export function StoryCard({ id: _id, name, story, href }: StoryCardProps) {
  // Truncate preview text to first few lines
  const truncatedText = useMemo(() => {
    const lines = story.split('\n').slice(0, 3)
    return lines.join('\n')
  }, [story])

  return (
    <a
      href={href}
      className="block h-48 p-4 border rounded-md bg-card text-card-foreground shadow-sm rotate-1 hover:rotate-0 transition-transform duration-200 hover:shadow-md"
    >
      <div className="flex flex-col h-full">
        <h3 className="font-semibold text-foreground mb-2 line-clamp-1">
          {name}
        </h3>
        <div className="flex-1 overflow-hidden">
          <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
            {truncatedText || 'No content'}
          </p>
        </div>
      </div>
    </a>
  )
}
