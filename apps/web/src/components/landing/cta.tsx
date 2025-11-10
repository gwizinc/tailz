import { Button } from '@/components/ui/button'

import { supportChannels } from './content'

export function CallToAction() {
  return (
    <section className="relative overflow-hidden bg-linear-to-r from-primary/10 via-background to-primary/5 py-24 sm:py-32">
      <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/30 to-transparent md:block" />
      <div className="container relative">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1 text-sm font-medium text-primary/80 ring-1 ring-primary/20">
              ready when you are
            </span>
            <h2 className="font-display text-3xl text-foreground sm:text-4xl lg:text-5xl">
              launch autonomous qa with kyoto in less than an afternoon
            </h2>
            <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
              Create a workspace, connect your repo, and invite teammates. Kyoto
              learns your product instantly and keeps every release on track.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href="/signup" className="gap-2">
                  start free
                </a>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-primary hover:text-primary/90"
                asChild
              >
                <a href="/book-demo" className="gap-2">
                  talk to product specialist
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-primary/20 bg-background/80 p-6 shadow-xl backdrop-blur">
            <h3 className="font-display text-xl text-foreground">
              need time-to-value fast?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose the support path that matches how your team ships.
            </p>
            <dl className="mt-6 space-y-4">
              {supportChannels.map((channel) => (
                <div
                  key={channel.label}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-sm"
                >
                  <dt className="font-medium text-foreground">
                    {channel.label}
                  </dt>
                  <dd>
                    <a
                      href={channel.href}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Visit
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
