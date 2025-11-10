import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Code,
  Cog,
  Gauge,
  Layers,
  LifeBuoy,
  ShieldCheck,
} from 'lucide-react'

export type Feature = {
  name: string
  description: string
  icon: LucideIcon
}

export type Metric = {
  label: string
  value: string
  helper?: string
}

export type PricingTier = {
  name: string
  price: string
  description: string
  cta: string
  highlighted?: boolean
  features: string[]
}

export type Faq = {
  question: string
  answer: string
}

export const coreFeatures: Feature[] = [
  {
    name: 'Scenario intelligence',
    description:
      'Kyoto ingests commit history, traces, and analytics data to craft reliable BDD scenarios that stay in sync with your product.',
    icon: Layers,
  },
  {
    name: 'Continuous verification',
    description:
      'Ship with confidence thanks to automated regression sweeps, service health monitoring, and flaky test quarantine.',
    icon: ShieldCheck,
  },
  {
    name: 'Seamless developer workflow',
    description:
      'Trigger Kyoto from any CI provider, receive inline feedback in GitHub checks, and merge with zero context switching.',
    icon: Cog,
  },
  {
    name: 'API-first platform',
    description:
      'Integrate Kyoto anywhere through a fully typed API, event webhooks, and first-class SDK support.',
    icon: Code,
  },
]

export const platformMetrics: Metric[] = [
  {
    label: 'Time to coverage',
    value: '11 min',
    helper: 'Median time from feature flag to verified scenario',
  },
  {
    label: 'Regression caught',
    value: '93%',
    helper: 'Critical bugs surfaced before reaching production',
  },
  {
    label: 'Developer hours saved',
    value: '26h',
    helper: 'Average engineering time reclaimed every sprint',
  },
]

export const testimonials = [
  {
    quote:
      'Kyoto feels like adding a senior QA engineer to every squad. The generated scenarios read exactly like the way our product managers think.',
    author: 'Priya Verma',
    role: 'Director of Engineering, Atlas',
  },
  {
    quote:
      'We replaced flaky Selenium suites with Kyoto in under two weeks. Confidence in each release jumped immediately and our team finally sleeps.',
    author: 'Jordan Lee',
    role: 'Staff Software Engineer, Nifty',
  },
  {
    quote:
      'The autonomous remediation flows are magic. Kyoto opens a patch before we even get to triage the incident.',
    author: 'Elena García',
    role: 'Head of Platform, Horizon AI',
  },
]

export const pricingTiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '$0',
    description: 'Everything you need to launch automated QA in minutes.',
    cta: 'Create free workspace',
    features: [
      '1 Repository',
      '20 Stories',
      'Unlimited Users',
      'Community Support',
    ],
  },
  {
    name: 'Team',
    price: '$49',
    description: 'Purpose built for fast-growing teams shipping weekly.',
    highlighted: true,
    cta: 'Start 30-day trial',
    features: [
      'Unlimited Repositories',
      'Unlimited Stories',
      'Unlimited Users',
      'Priority Support',
      'SLA',
    ],
  },
  {
    name: 'Enterprise',
    price: "Let's talk",
    description: 'Dedicated partnership for enterprises with complex needs.',
    cta: 'Book strategy session',
    features: [
      'Private VPC deployment',
      '24/7 incident response',
      'Custom compliance automation',
      'Onsite enablement and training',
    ],
  },
]

export const faqs: Faq[] = [
  {
    question: 'How does Kyoto generate test scenarios?',
    answer:
      'Kyoto combines production telemetry, user journeys, and commit metadata with LLM-driven reasoning. Every scenario is validated against your schema before it is committed.',
  },
  {
    question: 'Can I bring my own testing stack?',
    answer:
      'Yes. Kyoto exports executable specs for Playwright, Cypress, and custom runners. We also provide a first-party CLI and TypeScript SDK for deeper integrations.',
  },
  {
    question: 'What does remediation look like?',
    answer:
      'When Kyoto detects a regression it drafts a patch directly in GitHub, including updated tests, impact analysis, and rollout guidance. Engineers stay in the loop for final approval.',
  },
  {
    question: 'Is Kyoto secure for regulated teams?',
    answer:
      'Absolutely. Kyoto is SOC 2 Type II certified, supports SSO/SAML, offers regional data residency, and can run in your dedicated cloud perimeter.',
  },
]

export const supportChannels = [
  { label: 'Docs', href: '/docs', icon: BookOpen },
  { label: 'Status', href: 'https://status.kyoto.app', icon: Gauge },
  { label: 'Community', href: 'https://discord.gg/kyoto', icon: LifeBuoy },
  { label: 'Security', href: '/security', icon: ShieldCheck },
]

export const productLinks = [
  { label: 'Platform', href: '/product' },
  { label: 'Autonomous QA', href: '/autonomous-qa' },
  { label: 'Integrations', href: '/integrations' },
  { label: 'Changelog', href: '/changelog' },
]

export const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Customers', href: '/customers' },
  { label: 'Careers', href: '/careers' },
  { label: 'Blog', href: '/blog' },
]

export const footerLegal = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Responsible AI', href: '/responsible-ai' },
  { label: 'Contact', href: 'mailto:hello@kyoto.app' },
]
