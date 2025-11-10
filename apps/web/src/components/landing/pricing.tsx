import { Button } from '@/components/ui/button'

import { pricingTiers } from './content'

export function Pricing() {
  return (
    <section className="bg-background py-24 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            Pricing
          </p>
          <h2 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
            Goodbye,{' '}
            <span className="line-through text-muted-foreground/60">
              manual qa testing
            </span>
            . Hello Kyoto
          </h2>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {pricingTiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex h-full flex-col gap-6 rounded-3xl border bg-card/70 p-8 shadow-lg ${
                tier.highlighted
                  ? 'border-primary/60 shadow-xl'
                  : 'border-border/60'
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-primary tracking-[0.3em]">
                  {tier.name}
                </p>
                <p className="mt-4 font-display text-3xl font-semibold text-foreground">
                  {tier.price}
                  {tier.price !== 'Let’s talk' ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      /month
                    </span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <Button
                asChild
                size="lg"
                variant={tier.highlighted ? 'default' : 'outline'}
                className={
                  tier.highlighted
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-primary/40 text-primary'
                }
              >
                <a href="/login">{tier.cta}</a>
              </Button>

              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {tier.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 inline-flex size-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
