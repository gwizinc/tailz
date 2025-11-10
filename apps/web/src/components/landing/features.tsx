import { coreFeatures } from './content'

export function FeatureGrid() {
  return (
    <section className="bg-linear-to-b from-background via-background to-muted/30 py-24 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            Platform
          </p>
          <h2 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
            everything you need to automate quality without slowing teams down
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Kyoto orchestrates intelligent coverage, observability, and
            remediation so that product velocity never comes at the expense of
            safety.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {coreFeatures.map((feature) => (
            <div
              key={feature.name}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-8 shadow-lg transition hover:border-primary/50 hover:shadow-xl"
            >
              <div className="absolute -right-24 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-primary/5 blur-2xl transition group-hover:blur-[120px]" />
              <div className="relative flex h-full flex-col gap-4">
                <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <feature.icon className="size-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
                <div className="mt-auto">
                  <span className="text-sm font-medium text-primary">
                    Learn more →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
