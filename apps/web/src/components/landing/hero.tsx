import { ArrowRight, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LandingHero() {
  return (
    <section
      className="relative overflow-hidden bg-cover bg-center bg-no-repeat py-24 sm:py-28 lg:py-32"
      style={{ backgroundImage: "url('/kyoto.png')" }}
    >
      <div className="container flex flex-col gap-12 px-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-4 py-1 text-sm font-medium text-muted-foreground">
            ⛩️ Hello, Kyoto. Meet, your QA Agent
          </span>
          <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Ship it working.
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground sm:text-xl">
            Test your code without writing tests. Kyoto tests your code
            functionality to prevent regressions by writing and evaluating your
            user stories.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href="/signup" className="gap-2">
                Get started
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary/30 bg-background/60 backdrop-blur"
              asChild
            >
              <a href="/demo" className="gap-2">
                <PlayCircle className="size-4" />
                Watch platform tour
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
