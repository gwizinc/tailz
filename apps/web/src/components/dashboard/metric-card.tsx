import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { LineChart } from './line-chart'

interface MetricCardProps {
  title: string
  total: number
  data: ReadonlyArray<{ date: string; count: number }>
  strokeColor?: string
  className?: string
}

const numberFormatter = new Intl.NumberFormat()

export function MetricCard({
  title,
  total,
  data,
  strokeColor = 'hsl(var(--chart-1))',
  className,
}: MetricCardProps) {
  const latestCount = data.length > 0 ? data[data.length - 1]?.count ?? 0 : 0

  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Last day: {numberFormatter.format(latestCount)}
          </span>
        </div>
        <div className="text-3xl font-semibold tracking-tight">
          {numberFormatter.format(total)}
        </div>
      </CardHeader>
      <CardContent>
        <LineChart data={data} strokeColor={strokeColor} />
      </CardContent>
    </Card>
  )
}

