import { useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface OrgItem {
  slug: string
  name: string
}

export function OrgListApp() {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        const data = await trpc.org.listInstalled.query()
        if (!isMounted) {
          return
        }
        setOrgs(data.orgs)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load organizations')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    return () => {
      isMounted = false
    }
  }, [trpc])

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingProgress label="Loading organizations..." />
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-destructive">{error}</div>
      </AppLayout>
    )
  }

  if (orgs.length === 0) {
    return (
      <AppLayout>
        <div className="p-6">
          <EmptyState
            title="No organizations found"
            description="Install the GitHub app to get started with your organizations."
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 flex flex-col h-full overflow-auto">
        <h1 className="text-xl font-semibold text-foreground">Organizations</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <a
              key={org.slug}
              href={`/org/${org.slug}`}
              className="block"
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{org.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{org.slug}</p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
