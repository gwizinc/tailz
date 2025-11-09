import { cn } from '@/lib/utils'

type StoryStatus = 'pass' | 'fail' | 'error' | 'running' | null

interface StoryCardProps {
  id: string
  name: string
  href: string
  groups: string[]
  latestStatus: StoryStatus
}

function getStatusDisplay(status: StoryStatus) {
  if (!status) {
    return {
      label: 'Not yet evaluated',
      textClass: 'text-muted-foreground',
      dotClass: 'bg-muted',
    }
  }

  switch (status) {
    case 'pass':
      return {
        label: 'Passing',
        textClass: 'text-chart-1',
        dotClass: 'bg-chart-1',
      }
    case 'fail':
      return {
        label: 'Failing',
        textClass: 'text-destructive',
        dotClass: 'bg-destructive',
      }
    case 'error':
      return {
        label: 'Error',
        textClass: 'text-orange-600 dark:text-orange-500',
        dotClass: 'bg-orange-500',
      }
    case 'running':
      return {
        label: 'Running',
        textClass: 'text-primary',
        dotClass: 'bg-primary',
      }
    default:
      return {
        label: 'Not yet evaluated',
        textClass: 'text-muted-foreground',
        dotClass: 'bg-muted',
      }
  }
}

export function StoryCard({ id: _id, name, href, groups, latestStatus }: StoryCardProps) {
  const statusDisplay = getStatusDisplay(latestStatus)

  return (
    <a
      href={href}
      className="block px-4 py-3 text-sm transition-colors hover:bg-muted"
    >
      <div className="flex flex-col gap-2">
        <span className="font-medium text-foreground line-clamp-1">{name}</span>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1 font-medium',
              statusDisplay.textClass,
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                statusDisplay.dotClass,
              )}
            />
            {statusDisplay.label}
          </span>
        </div>
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
