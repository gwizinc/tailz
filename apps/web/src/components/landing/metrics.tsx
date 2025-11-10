import { platformMetrics } from './content'

export function Metrics() {
  return (
    <section className="bg-background py-24 sm:py-28">
      <div className="container grid gap-8 lg:grid-cols-[1fr_minmax(0,2fr)] lg:items-center">
        <div className="max-w-md space-y-5">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            未然に防ぐ
          </p>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">
            Kyoto catches regressions before they deploy.
          </h2>
          <p className="text-base text-muted-foreground sm:text-lg">
            Teams that adopt Kyoto reduce regression risk, ship faster, and
            spend more time pairing with customers instead of debugging brittle
            pipelines.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {platformMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-3xl border border-border/60 bg-card/60 p-6 text-center shadow-md"
            >
              <p className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
                {metric.value}
              </p>
              <p className="mt-2 text-sm font-medium tracking-[0.2em] text-muted-foreground">
                {metric.label.toLowerCase()}
              </p>
              {metric.helper ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {metric.helper}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
