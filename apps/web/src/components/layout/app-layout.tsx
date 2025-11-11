import type { ReactNode } from 'react'
import type { BreadcrumbItem } from '@/components/common/Breadcrumbs'

import { TopNav } from './top-nav'

interface Props {
  children: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  right?: ReactNode
}

export function AppLayout({ children, breadcrumbs, right }: Props) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-background">
      <TopNav breadcrumbs={breadcrumbs} right={right} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
