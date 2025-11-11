'use client'

import { navigate } from 'astro:transitions/client'
import { LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MdTempleBuddhist } from 'react-icons/md'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

  const user = session.data?.user
  const userImage = user?.image
  const userName = user?.name || user?.email || 'User'

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
        className={cn(
          'h-8 px-3 text-sm font-medium gap-1.5',
          'bg-linear-to-r from-white via-[#ffe6f2] to-[#ffcde8] text-foreground shadow-sm',
          'hover:from-white hover:via-[#ffd9ec] hover:to-[#ffbcd9] hover:shadow-md',
          'focus-visible:ring-primary/40 focus-visible:ring-offset-1',
        )}
        onClick={() => void navigate('/upcoming-features')}
      >
        <span aria-hidden="true" className="text-base leading-none">
          🌸
        </span>
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
            className="flex items-center gap-2 text-foreground transition-colors shrink-0"
          >
            <span className="font-display text-lg">⛩️ Kyoto</span>
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
