export type Locale = 'en' | 'zh'

export interface NavLinkItem {
  title: string
  href: string
}

export interface PlanFeature {
  text: string
}

export interface MarketingPlan {
  planKey: string
  title: string
  description: string
  billingMode: 'payg' | 'subscription' | 'custom'
  priceText: string
  features: string[]
  sort: number
}

export interface ModelInfo {
  name: string
  capabilityTags: string[]
  note: string
}

export interface ModelCategory {
  category: string
  title: string
  description: string
  models: ModelInfo[]
}

export interface FaqItem {
  question: string
  answer: string
}

export interface UseCaseItem {
  title: string
  description: string
}

export interface HomeContent {
  hero: {
    badge: string
    title: string
    subtitle: string
    description: string
    primaryCta: string
    secondaryCta: string
    codeTitle: string
    code: string
  }
  trustBar: string[]
  modelGateway: {
    title: string
    description: string
    items: { title: string; description: string }[]
  }
  flow: {
    title: string
    description: string
    outbound: { title: string; description: string }
    inbound: { title: string; description: string }
  }
  useCases: {
    title: string
    items: UseCaseItem[]
  }
  pricingPreview: {
    title: string
    description: string
    cta: string
  }
  faq: {
    title: string
    items: FaqItem[]
  }
  cta: {
    title: string
    description: string
    primaryCta: string
    secondaryCta: string
  }
}
