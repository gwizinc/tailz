import { Github } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function LandingNavbar() {
  return (
    <header className="relative z-20 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex flex-col items-center gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-lg font-semibold text-foreground"
        >
          <span aria-hidden="true" className="text-xl">
            ⛩️
          </span>
          <span className="font-display">Kyoto</span>
        </a>
        <nav className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 md:gap-8 text-sm font-medium text-muted-foreground">
          <a
            href="/#product"
            className="transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            Product
          </a>
          <a
            href="#/pricing"
            className="transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            Pricing
          </a>
          <a
            href="/about"
            className="transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            About
          </a>
        </nav>
        <div className="w-full sm:w-auto">
          <Button asChild size="sm" className="w-full sm:w-auto">
            <a href="/auth?redirect=/app" className="gap-2">
              <Github className="size-4" aria-hidden="true" />
              Sign in with GitHub
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
