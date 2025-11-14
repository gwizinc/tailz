import { cn } from '@/lib/utils'

interface StoryCardProps {
  id: string
  name: string
  href: string
  groups: string[]
}

export function StoryCard({
  id: _id,
  name,
  href,
  groups,
}: StoryCardProps) {

  // Check if story is being processed (title is missing or placeholder)
  const isProcessing = !name || name.trim() === '' || name.trim() === 'foobar'
  const displayName = isProcessing
    ? 'Newly crafted story is being processed...'
    : name

  return (
    <a
      href={href}
      className="block px-4 py-3 text-sm transition-colors hover:bg-muted"
    >
      <div className="flex flex-col gap-2">
        <span
          className={cn(
            'font-medium line-clamp-1',
            isProcessing ? 'text-muted-foreground italic' : 'text-foreground',
          )}
        >
          {displayName}
        </span>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <span
                key={group}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-[3px] text-[10px] font-medium text-primary"
              >
                {group}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  )
}
