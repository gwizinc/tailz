'use client'

import { navigate } from 'astro:transitions/client'
import { LogOut, Sparkles } from 'lucide-react'
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
import type { BreadcrumbItem } from '@/components/common/Breadcrumbs'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TopNavProps {
  breadcrumbs?: BreadcrumbItem[]
  right?: ReactNode
}

export function TopNav({ breadcrumbs, right }: TopNavProps) {
  const trpc = useTRPCClient()
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const session = useSession()
  const { setTheme, resolvedTheme } = useTheme()

  const user = session.data?.user
  const userImage = user?.image
  const userName = user?.name || user?.email || 'User'

  const handleToggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }, [resolvedTheme, setTheme])

  useEffect(() => {
    if (!session.data) {
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

  const showGithubLogin = session.data ? githubLogin : null

  const rightActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="h-8 px-3 text-sm"
        onClick={() => void navigate('/dashboard')}
      >
        Dashboard
      </Button>
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
            {showGithubLogin ? (
              <p className="text-xs text-muted-foreground">
                @{showGithubLogin}
              </p>
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
