import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { faqs } from './content'

export function Faq() {
  const [openItem, setOpenItem] = useState<string | null>(
    faqs[0]?.question ?? null,
  )

  return (
    <section className="bg-linear-to-b from-background via-muted/20 to-background py-24 sm:py-28">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-[0.3em] text-primary">
            faq
          </p>
          <h2 className="mt-4 font-display text-3xl text-foreground sm:text-4xl">
            everything you need to know before inviting kyoto to your stack
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Have more questions? Reach our solutions team any time at{' '}
            <a
              className="text-primary underline underline-offset-4"
              href="mailto:hello@kyoto.app"
            >
              hello@kyoto.app
            </a>
            .
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-border overflow-hidden rounded-3xl border border-border/60 bg-card/70 shadow-lg">
          {faqs.map((item) => {
            const isOpen = openItem === item.question
            return (
              <button
                key={item.question}
                type="button"
                className="w-full text-left"
                onClick={() => setOpenItem(isOpen ? null : item.question)}
              >
                <div className="flex items-start gap-4 px-6 py-6 sm:px-8 sm:py-8">
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-foreground">
                      {item.question}
                    </p>
                    {isOpen ? (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {item.answer}
                      </p>
                    ) : null}
                  </div>
                  <ChevronDown
                    className={`mt-1 size-5 text-muted-foreground transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
