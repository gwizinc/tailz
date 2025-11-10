import { Github, Linkedin } from 'lucide-react'

import {
  companyLinks,
  footerLegal,
  productLinks,
  supportChannels,
} from './content'

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
          <div className="space-y-6">
            <a href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold">
                k
              </span>
              <span className="font-display text-2xl text-foreground">
                kyoto
              </span>
            </a>
            <p className="max-w-sm text-sm text-muted-foreground">
              Kyoto is the autonomous QA platform that captures real user
              behavior and transforms it into resilient, production-grade
              coverage—keeping engineering teams focused on momentum.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com/gwizinc"
                aria-label="Kyoto on GitHub"
                className="rounded-full border border-border/60 p-2 text-muted-foreground transition hover:text-primary"
              >
                <Github className="size-5" />
              </a>
              <a
                href="https://www.linkedin.com/company/gwiz/"
                aria-label="Kyoto on LinkedIn"
                className="rounded-full border border-border/60 p-2 text-muted-foreground transition hover:text-primary"
              >
                <Linkedin className="size-5" />
              </a>
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <FooterColumn heading="Product" links={productLinks} />
            <FooterColumn heading="Company" links={companyLinks} />
            <FooterSupport />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Steve Peak
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {footerLegal.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="hover:text-primary"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  heading: string
  links: { label: string; href: string }[]
}

function FooterColumn({ heading, links }: FooterColumnProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-[0.3em] text-muted-foreground">
        {heading.toLowerCase()}
      </h3>
      <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
        {links.map((link) => (
          <li key={link.label}>
            <a className="hover:text-primary" href={link.href}>
              {link.label.toLowerCase()}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterSupport() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-[0.3em] text-muted-foreground">
        support
      </h3>
      <ul className="space-y-3 text-sm text-muted-foreground">
        {supportChannels.map((channel) => (
          <li key={channel.label} className="flex items-center gap-3">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <channel.icon className="size-4" />
            </span>
            <a className="hover:text-primary" href={channel.href}>
              {channel.label.toLowerCase()}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
