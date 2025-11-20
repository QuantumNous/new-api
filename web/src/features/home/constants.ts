/**
 * Home page constants
 * All hardcoded data for home page sections
 */
import { type TFunction } from 'i18next'

// Layout - Main base classes
export const MAIN_BASE_CLASSES = 'bg-background text-foreground w-full'

// Hero section - AI Applications (Left side)
export const AI_APPLICATIONS = [
  'LobeHub.Color',
  'Dify.Color',
  'OpenWebUI',
  'Cline',
] as const

// Hero section - AI Models (Right side)
export const AI_MODELS = [
  'Qwen.Color',
  'DeepSeek.Color',
  'Doubao.Color',
  'OpenAI',
  'Claude.Color',
  'Gemini.Color',
] as const

// Hero section - Gateway Features
export const GATEWAY_FEATURES = [
  'Cost Tracking',
  'Model Access',
  'Guardrails',
  'Observability',
  'Budgets',
  'Load Balancing',
  'Rate Limiting',
  'Token Mgmt',
  'Prompt Caching',
  'Pass-Through',
] as const

// Stats section - Default statistics
export const DEFAULT_STATS = [
  {
    value: '100',
    suffix: 'M+',
    description: 'requests served',
  },
  {
    value: '50',
    suffix: '+',
    description: 'AI models supported',
  },
  {
    value: '99.9',
    suffix: '%',
    description: 'uptime',
  },
  {
    value: '10',
    suffix: 'K+',
    description: 'active users',
  },
] as const

// Features section - Default features
export const DEFAULT_FEATURES = [
  {
    title: 'Lightning Fast',
    description:
      'Optimized network architecture ensures millisecond response times',
    iconName: 'Zap',
  },
  {
    title: 'Secure & Reliable',
    description:
      'Enterprise-grade security with comprehensive permission management',
    iconName: 'Shield',
  },
  {
    title: 'Global Coverage',
    description: 'Multi-region deployment for stable global access',
    iconName: 'Globe',
  },
  {
    title: 'Developer Friendly',
    description: 'Complete API documentation with multi-language SDK support',
    iconName: 'Code',
  },
  {
    title: 'High Performance',
    description: 'Support for high concurrency with automatic load balancing',
    iconName: 'Gauge',
  },
  {
    title: 'Transparent Billing',
    description: 'Pay-as-you-go with real-time usage monitoring',
    iconName: 'DollarSign',
  },
  {
    title: 'Team Collaboration',
    description: 'Multi-user management with flexible permission allocation',
    iconName: 'Users',
  },
  {
    title: 'Technical Support',
    description: 'Professional team providing 24/7 technical support',
    iconName: 'HeartHandshake',
  },
] as const

export function getGatewayFeatures(t: TFunction) {
  return GATEWAY_FEATURES.map((feature) => t(feature))
}

export function getDefaultStats(t: TFunction) {
  return DEFAULT_STATS.map((stat) => ({
    ...stat,
    description: stat.description ? t(stat.description) : undefined,
  }))
}

export function getDefaultFeatures(t: TFunction) {
  return DEFAULT_FEATURES.map((feature) => ({
    ...feature,
    title: t(feature.title),
    description: t(feature.description),
  }))
}
