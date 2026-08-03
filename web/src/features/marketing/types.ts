export type Locale = 'en' | 'zh'

export interface NavLink {
  label: string
  href: string
}

export interface ModelEntry {
  name: string
  tags: string
  note: string
}

export interface PricingPlan {
  planKey: string
  title: string
  description: string
  billingMode: string
  priceText: string
  features: string[]
  ctaLabel: string
  highlighted?: boolean
}

export interface UseCaseItem {
  title: string
  desc: string
}

export interface SolutionItem {
  title: string
  desc: string
}

export interface FaqItem {
  q: string
  a: string
}

export interface SiteContent {
  nav: NavLink[]
  hero: {
    badge: string
    title: string
    subtitle: string
    primaryCta: string
    secondaryCta: string
  }
  trustbar: {
    title: string
    items: string[]
  }
  gateway: {
    title: string
    subtitle: string
    inboundLabel: string
    outboundLabel: string
  }
  flow: {
    title: string
    desc: string
    chinaLabel: string
    globalLabel: string
  }
  useCases: {
    title: string
    items: UseCaseItem[]
  }
  pricing: {
    title: string
    subtitle: string
    note: string
  }
  models: {
    title: string
    subtitle: string
  }
  solutions: {
    title: string
    subtitle: string
    items: SolutionItem[]
  }
  faq: {
    title: string
    items: FaqItem[]
  }
  contact: {
    title: string
    subtitle: string
    submit: string
    submitting: string
    success: string
    error: string
    name: string
    email: string
    company: string
    region: string
    useCase: string
    volume: string
    message: string
  }
  footerCta: {
    title: string
    subtitle: string
    cta: string
  }
}
