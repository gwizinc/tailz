import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '../ui/sidebar'
import { Breadcrumbs } from '@/components/common/Breadcrumbs'
import { ThemeToggle } from '@/components/ui/theme-toggle'

import { AppSidebar } from './app-sidebar'

interface BreadcrumbItem {
  label: string
  href?: string
  showGithubIcon?: boolean
}

interface Props {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  right?: ReactNode
}

export function AppLayout({ children, breadcrumbs, right }: Props) {
  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          <AppSidebar />

          <SidebarInset className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b">
              <div className="flex items-center justify-between gap-3 px-4 py-2">
                {breadcrumbs ? (
                  <Breadcrumbs
                    items={breadcrumbs}
                    right={
                      right ? (
                        <div className="flex items-center gap-2">
                          {right}
                          <ThemeToggle />
                        </div>
                      ) : (
                        <ThemeToggle />
                      )
                    }
                    className="px-0 py-0 flex-1"
                  />
                ) : (
                  <>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      {right ? <div>{right}</div> : null}
                      <ThemeToggle />
                    </div>
                  </>
                )}
              </div>
            </div>
            {children}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
