interface StoryCardProps {
  id: string
  name: string
  href: string
}

export function StoryCard({ id: _id, name, href }: StoryCardProps) {
  return (
    <a
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted"
    >
      <span className="font-medium text-foreground line-clamp-1">{name}</span>
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        Group Name
      </span>
    </a>
  )
}
