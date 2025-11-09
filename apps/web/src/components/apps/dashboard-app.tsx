import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { MetricCard } from '@/components/dashboard/metric-card'
import { AppProvider } from '@/components/providers/app-provider'
import { LoadingProgress } from '@/components/ui/loading-progress'

interface DailyMetricPoint {
  date: string
  count: number
}

interface DashboardMetrics {
  total: number
  daily: ReadonlyArray<DailyMetricPoint>
}

interface DashboardData {
  projects: DashboardMetrics
  users: DashboardMetrics
  runs: DashboardMetrics
}

export function DashboardApp() {
  return (
    <AppProvider>
      <DashboardAppContent />
    </AppProvider>
  )
}

function DashboardAppContent() {
  const trpc = useTRPCClient()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      try {
        const response = await trpc.dashboard.overview.query()
        if (!isMounted) {
          return
        }
        setData(response)
        setError(null)
      } catch (err) {
        if (!isMounted) {
          return
        }
        setError(
          err instanceof Error ? err.message : 'Failed to load dashboard data',
        )
      } finally {
        if (!isMounted) {
          return
        }
        setIsLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      isMounted = false
    }
  }, [trpc])

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}>
        <LoadingProgress label="Loading dashboard..." />
      </AppLayout>
    )
  }

  if (error || !data) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}>
        <div className="p-6 text-sm text-destructive">{error}</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}>
      <div className="flex h-full flex-col overflow-auto p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Global overview of projects, users, and CI health across the
            platform.
          </p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <MetricCard
            title="Projects"
            total={data.projects.total}
            data={data.projects.daily}
            strokeColor="hsl(var(--chart-1))"
          />
          <MetricCard
            title="Users"
            total={data.users.total}
            data={data.users.daily}
            strokeColor="hsl(var(--chart-2))"
          />
          <MetricCard
            title="CI Runs"
            total={data.runs.total}
            data={data.runs.daily}
            strokeColor="hsl(var(--chart-3))"
          />
        </div>
      </div>
    </AppLayout>
  )
}

