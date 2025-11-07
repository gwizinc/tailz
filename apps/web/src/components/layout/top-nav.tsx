'use client'

import { navigate } from 'astro:transitions/client'
import { Home, LogOut, Zap } from 'lucide-react'
import { useState } from 'react'
import { GiWhaleTail } from 'react-icons/gi'

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
  const session = useSession()

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

  const user = session.data?.user
  const userImage = user?.image
  const userName = user?.name || user?.email || 'User'

  const rightActions = (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => void navigate('/')}
        title="Home"
      >
        <Home size={16} />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={isTriggering}
        onClick={() => void handleTestHelloWorld()}
        title="Test Hello World"
      >
        <Zap size={16} />
      </Button>

      {right ? <div>{right}</div> : null}

      <ThemeToggle />

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
