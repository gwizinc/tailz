import { useCallback, useEffect, useState } from 'react'

import { useTRPCClient } from '@/client/trpc'
import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { LoadingProgress } from '@/components/ui/loading-progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SiGithub } from 'react-icons/si'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GITHUB_APP_SLUG } from 'astro:env/client'

interface OrgItem {
  slug: string
  name: string
  accountName: string | null
  repoCount: number
}

export function OrgListApp() {
  const trpc = useTRPCClient()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const installUrl = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`

  const queryOrganizations = useCallback(async () => {
    const data = await trpc.org.listInstalled.query()
    return data.orgs
  }, [trpc])

  useEffect(() => {
    let isMounted = true

    void (async () => {
      try {
        const loadedOrgs = await queryOrganizations()
        if (!isMounted) {
          return
        }
        setOrgs(loadedOrgs)
        setError(null)
      } catch (e) {
        if (!isMounted) {
          return
        }
        setError(
          e instanceof Error ? e.message : 'Failed to load organizations',
        )
      } finally {
        if (!isMounted) {
          return
        }
        setIsLoading(false)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [queryOrganizations])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await trpc.org.refreshInstallations.mutate()
      const refreshedOrgs = await queryOrganizations()
      setOrgs(refreshedOrgs)
      setError(null)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Failed to refresh organizations',
      )
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [queryOrganizations, trpc])

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
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <p
            className="text-sm font-semibold tracking-[0.3em] text-primary mb-4"
            title="Sakusei - to create."
          >
            さくせい
          </p>
          <h2 className="text-2xl font-display text-foreground mb-3">
            Connect your team
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-md">
            Install the GitHub app to get started with your organizations.
          </p>
          <Button asChild size="lg">
            <a href={installUrl}>Install our GitHub App</a>
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 flex flex-col h-full overflow-auto">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-display text-foreground">Teams</h1>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                  aria-label="Refresh organizations"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh teams and repos</TooltipContent>
            </Tooltip>
            <Button asChild>
              <a href={installUrl}>Add new organization</a>
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <a key={org.slug} href={`/org/${org.slug}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <SiGithub className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">
                      {org.accountName ?? org.name}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">@{org.slug}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {org.repoCount}
                    </span>{' '}
                    {org.repoCount === 1 ? 'repository' : 'repositories'}
                  </p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
