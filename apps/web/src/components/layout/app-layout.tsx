import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '../ui/sidebar'

import { AppSidebar } from './app-sidebar'

interface Props {
  children: ReactNode
}

export function AppLayout({ children }: Props) {
  return (
    <div className="h-screen w-full flex flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider>
          <AppSidebar />

          <SidebarInset className="flex flex-1 flex-col overflow-hidden">
            {children}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
