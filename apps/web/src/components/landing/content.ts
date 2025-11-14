import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Bug,
  Gauge,
  GitCommit,
  Languages,
  LifeBuoy,
  ShieldCheck,
} from 'lucide-react'

export type Feature = {
  katakana: string
  romaji: string
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

export type Story = {
  quote: string
}

export const coreFeatures: Feature[] = [
  {
    katakana: 'かいぜん',
    romaji: 'Kaizen - Continuous improvement.',
    name: 'Continuous Improvement',
    description:
      'Like all the other CI tools, Kyoto is a continuously monitors and provides feedback on every commit.',
    icon: GitCommit,
  },
  {
    katakana: 'ぎゃっこう',
    romaji: 'Gyakkou - Against the light.',
    name: 'Prevent Regression',
    description:
      "Don't let regressions sneak into your production. Kyoto will catch them before you deploy.",
    icon: Bug,
  },
  {
    katakana: '守り',
    romaji: 'Mamori - Protection',
    name: 'One click protection.',
    description:
      'Immediate protection after sign up. No configuration, no setup required.',
    icon: ShieldCheck,
  },
  {
    katakana: '言語学',
    romaji: 'Gengogaku - Natural language.',
    name: 'Natural Language Tests',
    description:
      'Tests are written in natural language, without any required format.',
    icon: Languages,
  },
]

export const platformMetrics: Metric[] = [
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

export const stories: Story[] = [
  {
    quote:
      'When I click create new post, then I see a dialog where I can enter a title and content. Then when I hit post I see my post as the first item in the list.',
  },
  {
    quote:
      'When I click on a post, then I see the post details page with the title and content. When I click the edit button, then I see a dialog where I can edit the title and content. When I hit save, then I see the updated post details page.',
  },
  {
    quote:
      'When I click the delete button, then I see a confirmation dialog. When I hit delete, then I see the post is removed from the list.',
  },
]

export const pricingTiers: PricingTier[] = [
  {
    name: 'Pebble',
    price: '$0',
    description: 'Everything you need to launch automated QA in minutes.',
    cta: 'Create free workspace',
    features: [
      '1 Repository',
      '10 Stories',
      'Unlimited Runs',
      'Unlimited Users',
      'Community Support',
    ],
  },
  {
    name: 'Temple',
    price: '$50',
    description: 'Purpose built for fast-growing teams shipping weekly.',
    highlighted: true,
    cta: 'Start 30-day trial',
    features: [
      'Unlimited Repositories',
      'Unlimited Stories',
      'Unlimited Runs',
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
    question: 'How does Kyoto work exactly?',
    answer:
      'Each commit to GitHub will be inspected by Kyoto against user stories you write. These tests are done by an AI agent that walks through your code to ensure every step in the story is achievable.',
  },
  {
    question: 'Do I have to write these user stories?',
    answer:
      'No. Kyoto will review your code and write user stories automatically for the first key features in your product. We will improve this over time too.',
  },
  {
    question: 'Is Kyoto secure?',
    answer:
      'Absolutely. Though we are new, we are committed to the highest security standards. Our entire codebase is open source for review and audit.',
  },
]

export const supportChannels = [
  { label: 'Docs', href: '/docs', icon: BookOpen },
  { label: 'Status', href: 'https://status.kyoto.app', icon: Gauge },
  { label: 'Community', href: 'https://discord.gg/kyoto', icon: LifeBuoy },
  { label: 'Security', href: '/security', icon: ShieldCheck },
]

export const companyLinks = [
  { label: 'About', href: '/about' },
  // { label: 'Blog', href: '/blog' },
]

export const footerLegal = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: 'mailto:hello@usekyoto.com' },
]
