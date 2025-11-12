import { coreFeatures } from './content'

export function FeatureGrid() {
  return (
    <section
      id="product"
      className="bg-linear-to-b from-background via-background to-muted/30 py-24 sm:py-28"
    >
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            侘寂プラットフォーム
          </p>
          <h2 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
            Dear fellow developers,
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            In this new age of AI, writing tests is becoming less common as we
            vibe code new and existing products. Yet the importance of testing
            code has not changed, but maybe the way we test can change. Kyoto is
            that new way to test code through story-telling and natural
            language.
          </p>
          <p className="mt-6 pl-6 text-base italic text-muted-foreground sm:text-lg">
            <i>
              Crafted with intention by the creators of{' '}
              <a href="https://codecov.io" className="text-primary">
                Codecov
              </a>
            </i>
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
                <p className="text-sm font-semibold tracking-[0.3em] text-primary">
                  {feature.katakana}
                </p>
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
