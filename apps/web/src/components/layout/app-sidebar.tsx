import { navigate } from 'astro:transitions/client'
import { Home, LogOut, Zap } from 'lucide-react'
import { useState } from 'react'
import { MdTempleBuddhist } from 'react-icons/md'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { signOut } from '@/client/auth-client'
import { useTRPCClient } from '@/client/trpc'

import { SidebarFooter } from '../ui/sidebar'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  href?: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}

function NavItem({
  icon,
  label,
  href,
  active = false,
  disabled = false,
  onClick,
}: NavItemProps) {
  const [clickActive, setClickActive] = useState(false)

  const handleClick = () => {
    if (disabled) {
      return
    }
    if (onClick) {
      onClick()
    } else if (href) {
      setClickActive(true)
      void navigate(href)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            className={cn(
              'w-10 h-10 rounded-md',
              active || clickActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
            onClick={handleClick}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function AppSidebar() {
  const [currentPath] = useState(() => window.location.pathname)
  const trpc = useTRPCClient()
  const [isTriggering, setIsTriggering] = useState(false)

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

  return (
    <div className="w-[56px] h-full bg-background border-r flex flex-col items-center py-4 gap-6 px-2">
      <MdTempleBuddhist size={24} className="text-muted-foreground" />

      <NavItem
        icon={<Home size={15} />}
        label="Home"
        href={'/'}
        active={currentPath === '/'}
      />

      <div className="grow" />

      <SidebarFooter>
        <NavItem
          icon={<Zap size={15} />}
          label="Test Hello World"
          disabled={isTriggering}
          onClick={() => void handleTestHelloWorld()}
        />
        <NavItem
          icon={<LogOut size={15} />}
          label="Logout"
          onClick={() => void signOut()}
        />
      </SidebarFooter>
    </div>
  )
}
