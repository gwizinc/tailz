'use client'

import { navigate } from 'astro:transitions/client'
import { ChevronDown, LogOut, RefreshCw, Sparkles, Zap } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { GiWhaleTail } from 'react-icons/gi'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useTRPCClient } from '@/client/trpc'
import { useSession, signOut } from '@/client/auth-client'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
  showGithubIcon?: boolean
}

interface TopNavProps {
  breadcrumbs?: BreadcrumbItem[]
  right?: ReactNode
}

export function TopNav({ breadcrumbs, right }: TopNavProps) {
  const trpc = useTRPCClient()
  const [isTriggering, setIsTriggering] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const session = useSession()
  const { setTheme, resolvedTheme } = useTheme()

  const handleTestHelloWorld = async () => {
    setIsTriggering(true)
    try {
      await trpc.test.helloWorld.mutate()
    } catch (error) {
      console.error('Failed to trigger test task:', error)
    } finally {
      setIsTriggering(false)
    }
  }

  const handleRefreshInstallations = async () => {
    setIsRefreshing(true)
    try {
      await trpc.org.refreshInstallations.mutate()
    } catch (error) {
      console.error('Failed to refresh installations:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const user = session.data?.user
  const userImage = user?.image
  const userName = user?.name || user?.email || 'User'

  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  useEffect(() => {
    if (!session.data) {
      setGithubLogin(null)
      return
    }

    let isMounted = true

    void (async () => {
      try {
        const result = await trpc.user.get.query()
        if (!isMounted) {
          return
        }

        setGithubLogin(result.githubLogin ?? null)
      } catch (error) {
        console.error('Failed to fetch GitHub login', error)
        if (!isMounted) {
          return
        }
        setGithubLogin(null)
      }
    })()

    return () => {
      isMounted = false
    }
  }, [session.data, trpc])

  const rightActions = (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 gap-2 px-2" title="Dev">
            <span className="text-sm">Dev</span>
            <ChevronDown size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => void handleTestHelloWorld()}
            disabled={isTriggering}
          >
            <Zap className="mr-2 h-4 w-4" />
            Start Hello world Task
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void handleRefreshInstallations()}
            disabled={isRefreshing}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh orgs/repos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        className={cn(
          'h-8 px-3 text-sm text-white',
          'bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-500 shadow-sm',
          'hover:from-violet-600 hover:via-indigo-600 hover:to-sky-600 hover:shadow-md',
          'focus-visible:ring-indigo-500/70 focus-visible:ring-offset-1',
        )}
        onClick={() => void navigate('/upcoming-features')}
      >
        <Sparkles className="h-4 w-4" />
        What&apos;s next?
      </Button>

      {right ? <div>{right}</div> : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 rounded-full p-0"
            title={userName}
          >
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{userName}</p>
            {user?.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
            {githubLogin ? (
              <p className="text-xs text-muted-foreground">@{githubLogin}</p>
            ) : null}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              const target = event.target as HTMLElement | null
              if (target?.closest('[data-theme-toggle-button="true"]')) {
                return
              }
              handleToggleTheme()
            }}
            className="gap-2 cursor-pointer"
          >
            <span className="text-sm">Theme</span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="border-b bg-muted/30">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <a
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <GiWhaleTail size={20} />
          </a>
          {breadcrumbs ? (
            <Breadcrumbs
              items={breadcrumbs}
              className="px-0 py-0 flex-1 min-w-0"
            />
          ) : null}
        </div>

        {rightActions}
      </div>
    </div>
  )
}
