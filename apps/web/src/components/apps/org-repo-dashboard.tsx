import { useMemo, useState } from 'react'
import { SiGithub } from 'react-icons/si'
import { Clock3, ChevronDown, Plus, BookMarked } from 'lucide-react'

import { AppLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTRPCClient } from '@/client/trpc'
import { cn } from '@/lib/utils'

interface RepoItem {
  id: string
  name: string
  defaultBranch?: string
  isPrivate: boolean
  storyCount: number
  lastRunStatus: 'pass' | 'fail' | 'skipped' | 'running' | 'error' | null
  lastRunAt: Date | null
}

interface OrgData {
  id: string
  slug: string
  name: string
}

interface Props {
  org: OrgData | null
  repos: RepoItem[]
}

type SortOption = 'name' | 'stories' | 'lastRun'

export function OrgRepoDashboard({ org, repos }: Props) {
  const statusConfig: Record<
    NonNullable<RepoItem['lastRunStatus']>,
    {
      label: string
      dotClass: string
    }
  > = {
    pass: {
      label: 'Passed',
      dotClass: 'bg-chart-1',
    },
    fail: {
      label: 'Failed',
      dotClass: 'bg-destructive',
    },
    skipped: {
      label: 'Skipped',
      dotClass: 'bg-muted-foreground',
    },
    running: {
      label: 'Running',
      dotClass: 'bg-primary',
    },
    error: {
      label: 'Error',
      dotClass: 'bg-orange-500',
    },
  }

  const trpc = useTRPCClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [dialogSearchQuery, setDialogSearchQuery] = useState('')
  const [selectedRepoName, setSelectedRepoName] = useState<string | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>('name')
  const [enabling, setEnabling] = useState(false)
  const [allRepos, setAllRepos] = useState<
    Array<{
      id: string
      name: string
      defaultBranch: string | null
      enabled: boolean
      isPrivate: boolean
    }>
  >([])
  const [loadingRepos, setLoadingRepos] = useState(false)

  const loadRepos = async () => {
    if (!org?.slug) {
      return
    }
    setLoadingRepos(true)
    try {
      const data = await trpc.repo.listByOrg.query({ orgName: org.slug })
      const reposList = data.repos as Array<{
        id: string
        name: string
        defaultBranch: string | null
        enabled: boolean
        isPrivate: boolean
      }>
      setAllRepos(reposList)
    } catch (error) {
      console.error('Failed to load repositories:', error)
    } finally {
      setLoadingRepos(false)
    }
  }

  const dialogFilteredRepos = allRepos.filter((repo) => {
    if (!dialogSearchQuery.trim()) {
      return !repo.enabled
    }
    const query = dialogSearchQuery.toLowerCase()
    return (
      !repo.enabled &&
      (repo.name.toLowerCase().includes(query) ||
        `${org?.slug}/${repo.name}`.toLowerCase().includes(query))
    )
  })

  const repoCount = repos.length

  const filteredRepos = useMemo(() => {
    const query = listSearchQuery.trim().toLowerCase()
    if (!query) {
      return repos
    }

    return repos.filter((repo) =>
      `${org?.slug ?? ''}/${repo.name}`.toLowerCase().includes(query),
    )
  }, [listSearchQuery, org?.slug, repos])

  const displayedRepos = useMemo(() => {
    const sorted = [...filteredRepos]
    switch (sortOption) {
      case 'stories':
        sorted.sort((a, b) => b.storyCount - a.storyCount)
        break
      case 'lastRun':
        sorted.sort((a, b) => {
          const aTime = a.lastRunAt ? a.lastRunAt.getTime() : 0
          const bTime = b.lastRunAt ? b.lastRunAt.getTime() : 0
          return bTime - aTime
        })
        break
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return sorted
  }, [filteredRepos, sortOption])

  const handleEnableRepo = async () => {
    if (!org?.slug || !selectedRepoName) {
      return
    }
    setEnabling(true)
    try {
      await trpc.repo.enableRepo.mutate({
        orgName: org.slug,
        repoName: selectedRepoName,
      })
      window.location.reload()
    } catch (error) {
      console.error('Failed to connect repository:', error)
    } finally {
      setEnabling(false)
    }
  }

  const handleOpenDialog = () => {
    setIsDialogOpen(true)
    void loadRepos()
  }

  const formatRelativeTime = (value: Date | null): string | null => {
    if (!value) {
      return null
    }

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    let deltaSeconds = Math.round((value.getTime() - Date.now()) / 1000)

    const units: Array<{
      limit: number
      divisor: number
      unit: Intl.RelativeTimeFormatUnit
    }> = [
      { limit: 60, divisor: 1, unit: 'second' },
      { limit: 3600, divisor: 60, unit: 'minute' },
      { limit: 86400, divisor: 3600, unit: 'hour' },
      { limit: 604800, divisor: 86400, unit: 'day' },
      { limit: 2629800, divisor: 604800, unit: 'week' },
      { limit: 31557600, divisor: 2629800, unit: 'month' },
    ]

    for (const { limit, divisor, unit } of units) {
      if (Math.abs(deltaSeconds) < limit) {
        return rtf.format(Math.round(deltaSeconds / divisor), unit)
      }
    }

    return rtf.format(Math.round(deltaSeconds / 31557600), 'year')
  }

  const formatStoryCount = (count: number): string =>
    `${count} ${count === 1 ? 'story' : 'stories'}`

  return (
    <AppLayout
      breadcrumbs={
        org
          ? [
              {
                label: org.slug,
                href: `/org/${org.slug}`,
              },
            ]
          : undefined
      }
    >
      <div className="flex h-full flex-col overflow-hidden">
        <div className="border-b border-border bg-background/80 px-6 py-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="text-xl font-semibold text-foreground">
                <span>{org?.name ?? 'Organization'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {org?.slug ? (
                  <a
                    href={`https://github.com/${org.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-foreground transition-colors"
                  >
                    <SiGithub className="h-4 w-4 text-muted-foreground" />
                    <span>{org.slug}</span>
                  </a>
                ) : null}
                <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                  {repoCount} {repoCount === 1 ? 'repository' : 'repositories'}
                </span>
              </div>
            </div>
            <Button onClick={handleOpenDialog} className="gap-2">
              <Plus className="h-5 w-5" />
              <span>Add Repository</span>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Input
              placeholder="Find a repository..."
              value={listSearchQuery}
              onChange={(event) => setListSearchQuery(event.target.value)}
              className="min-w-[220px] flex-1"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-sm"
                >
                  Sort
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup
                  value={sortOption}
                  onValueChange={(value) => setSortOption(value as SortOption)}
                >
                  <DropdownMenuRadioItem value="name">
                    Name
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="stories">
                    Story count
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="lastRun">
                    Last CI run
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex-1 overflow-auto px-6 py-6">
          {repoCount === 0 ? (
            <EmptyState
              title="No repositories activated yet"
              description="Enable your first repository to start tracking stories, CI runs, and more."
              action={
                <Button onClick={handleOpenDialog} className="gap-2">
                  <Plus className="h-5 w-5" />
                  <span>Connect Repository</span>
                </Button>
              }
            />
          ) : displayedRepos.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-lg border border-dashed border-border p-8 text-center">
                <h3 className="text-sm font-medium text-foreground">
                  No repositories match your search
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try adjusting your filters or clear the search to view all
                  repositories.
                </p>
              </div>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {displayedRepos.map((repo) => {
                const statusMeta = repo.lastRunStatus
                  ? statusConfig[repo.lastRunStatus]
                  : null
                const relativeTime = formatRelativeTime(repo.lastRunAt)

                return (
                  <li
                    key={repo.id}
                    className="border-b border-border px-6 py-5 last:border-b-0"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/org/${org?.slug}/repo/${repo.name}`}
                          className="text-base font-semibold text-primary hover:underline"
                        >
                          {repo.name}
                        </a>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {repo.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>{formatStoryCount(repo.storyCount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusMeta ? (
                            <>
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  statusMeta.dotClass,
                                )}
                              />
                              <span className="text-muted-foreground">
                                Last CI run {statusMeta.label.toLowerCase()}
                                {relativeTime ? ` • ${relativeTime}` : ''}
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock3 className="h-4 w-4 text-muted-foreground" />
                              <span>No CI runs yet</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Repository</DialogTitle>
            <DialogDescription>
              Search and select a repository to connect for{' '}
              {org?.slug ? `${org.slug}` : 'this organization'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Input
                placeholder="Search by repository name..."
                value={dialogSearchQuery}
                onChange={(e) => {
                  setDialogSearchQuery(e.target.value)
                  setSelectedRepoName(null)
                }}
              />
            </div>
            {loadingRepos ? (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Loading repositories...
              </div>
            ) : dialogFilteredRepos.length === 0 ? (
              dialogSearchQuery.trim() ? (
                <div className="space-y-3 py-6 text-center text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    No matching repositories found
                  </p>
                  <p>
                    Need to connect another repo?{' '}
                    <a
                      href="/setup"
                      className="font-medium text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Configure the GitHub app
                    </a>{' '}
                    to add more repositories and projects to Kyoto.
                  </p>
                  <p>
                    After updating the installation, reopen this dialog to
                    search again.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  Start typing to search for repositories
                </div>
              )
            ) : (
              <div className="border rounded-md max-h-60 overflow-auto">
                <ul className="divide-y">
                  {dialogFilteredRepos.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        'cursor-pointer p-3 hover:bg-accent',
                        selectedRepoName === r.name && 'bg-accent',
                      )}
                      onClick={() => {
                        setSelectedRepoName(r.name)
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <BookMarked className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate text-sm font-medium text-foreground">
                            {r.name}
                          </span>
                        </div>
                        <span className="flex-shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {r.isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setDialogSearchQuery('')
                setSelectedRepoName(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleEnableRepo()
              }}
              disabled={!selectedRepoName || enabling}
            >
              {enabling ? 'Connecting...' : 'Connect repository'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
