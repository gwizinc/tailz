import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MinusCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type StoryStatus = 'pass' | 'fail' | 'running' | 'skipped' | 'blocked'

interface StoryStatusCheckProps {
  status: StoryStatus
  className?: string
}

export function StoryStatusCheck({ status, className }: StoryStatusCheckProps) {
  const iconProps = {
    className: cn('size-4', className),
  }

  switch (status) {
    case 'pass':
      return (
        <CheckCircle2
          {...iconProps}
          className={cn(
            'text-green-600 dark:text-green-500',
            iconProps.className,
          )}
        />
      )
    case 'fail':
      return (
        <XCircle
          {...iconProps}
          className={cn('text-red-600 dark:text-red-500', iconProps.className)}
        />
      )
    case 'running':
      return (
        <Loader2
          {...iconProps}
          className={cn(
            'text-yellow-600 dark:text-yellow-500 animate-spin',
            iconProps.className,
          )}
        />
      )
    case 'skipped':
      return (
        <MinusCircle
          {...iconProps}
          className={cn('text-muted-foreground', iconProps.className)}
        />
      )
    case 'blocked':
      return (
        <AlertTriangle
          {...iconProps}
          className={cn(
            'text-amber-600 dark:text-amber-500',
            iconProps.className,
          )}
        />
      )
    default:
      return null
  }
}
