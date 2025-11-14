import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatusDisplay } from './run-detail-view-types'

interface RunTitleSectionProps {
  commitTitle: string
  runStatusDescriptor: string
  relativeStarted: string
  absoluteStarted: string
  durationDisplay: string
  statusDisplay: StatusDisplay
}

export function RunTitleSection({
  commitTitle,
  runStatusDescriptor,
  relativeStarted,
  absoluteStarted,
  durationDisplay,
  statusDisplay,
}: RunTitleSectionProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <statusDisplay.Icon
          className={cn(
            'size-10',
            statusDisplay.heroClassName,
            statusDisplay.shouldSpin ? 'animate-spin' : '',
          )}
        />
        <div className="space-y-2">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold text-foreground md:text-2xl">
              {commitTitle}
            </h1>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Timer className="size-3.5" />
                <span className="flex items-center gap-1">
                  {runStatusDescriptor}{' '}
                  <time dateTime={absoluteStarted} title={absoluteStarted}>
                    {relativeStarted}
                  </time>
                  {durationDisplay !== '—' ? ` in ${durationDisplay}` : ''}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          statusDisplay.chipClassName,
        )}
      >
        <statusDisplay.Icon
          className={cn(
            'size-4',
            statusDisplay.chipIconClassName,
            statusDisplay.shouldSpin ? 'animate-spin' : '',
          )}
        />
        {statusDisplay.label}
      </span>
    </div>
  )
}
