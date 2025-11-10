import { testimonials } from './content'

export function Testimonials() {
  return (
    <section className="bg-linear-to-b from-muted/30 via-background to-background py-24 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            customer stories
          </p>
          <h2 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
            teams deliver with calm confidence after pairing with kyoto
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            From scale-ups to platform leaders, our customers build resilient
            shipping culture while keeping quality front and center.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {testimonials.map((quote) => (
            <figure
              key={quote.author}
              className="rounded-3xl border border-border/60 bg-card/70 p-8 shadow-lg transition hover:border-primary/30 hover:shadow-xl"
            >
              <blockquote className="text-lg text-foreground">
                “{quote.quote}”
              </blockquote>
              <figcaption className="mt-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">{quote.author}</p>
                <p>{quote.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
