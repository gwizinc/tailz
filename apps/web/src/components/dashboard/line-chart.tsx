import type { ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

interface LineChartPoint {
  date: string
  count: number
}

interface LineChartProps {
  data: ReadonlyArray<LineChartPoint>
  className?: string
  strokeColor?: string
  fallback?: ReactNode
}

const VIEWBOX_WIDTH = 240
const VIEWBOX_HEIGHT = 80

export function LineChart({
  data,
  className,
  strokeColor = 'hsl(var(--chart-1))',
  fallback = null,
}: LineChartProps) {
  const gradientId = useId()

  if (data.length === 0) {
    return fallback ? <>{fallback}</> : null
  }

  const counts = data.map((point) => point.count)
  const max = Math.max(...counts)
  const min = Math.min(...counts)
  const range = max - min || 1

  const points = data
    .map((point, index) => {
      const x =
        data.length === 1
          ? VIEWBOX_WIDTH
          : (index / (data.length - 1)) * VIEWBOX_WIDTH
      const y =
        VIEWBOX_HEIGHT -
        ((point.count - min) / range) * VIEWBOX_HEIGHT

      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const lastPoint = data[data.length - 1]
  const lastX =
    data.length === 1
      ? VIEWBOX_WIDTH
      : ((data.length - 1) / (data.length - 1)) * VIEWBOX_WIDTH
  const lastY =
    VIEWBOX_HEIGHT -
    ((lastPoint.count - min) / range) * VIEWBOX_HEIGHT

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={cn('h-24 w-full text-primary', className)}
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily trend line chart"
    >
      <defs>
        <linearGradient id={`${gradientId}-stroke`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.85} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={`url(#${gradientId}-stroke)`}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3.5}
        fill={strokeColor}
        stroke="var(--color-background)"
        strokeWidth={1.5}
      />
    </svg>
  )
}

