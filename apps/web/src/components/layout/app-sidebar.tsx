import { navigate } from 'astro:transitions/client'
import { Home, LogOut } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { signOut } from '@/client/auth-client'

import { SidebarFooter } from '../ui/sidebar'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  href?: string
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, href, active = false, onClick }: NavItemProps) {
  const [clickActive, setClickActive] = useState(false)

  const handleClick = () => {
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

  return (
    <div className="w-[56px] h-full bg-background border-r flex flex-col items-center py-4 gap-6 px-2">
      <NavItem
        icon={<Home size={15} />}
        label="Home"
        href={'/'}
        active={currentPath === '/'}
      />

      <div className="grow" />

      <SidebarFooter>
        <NavItem icon={<LogOut size={15} />} label="Logout" onClick={() => void signOut()} />
      </SidebarFooter>
    </div>
  )
}
