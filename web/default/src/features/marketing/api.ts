import { api } from '@/lib/api'

import type { MarketingPlan, ModelCategory } from './types'

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export interface SiteConfig {
  site_name: string
  logo: string
  footer_html: string
  default_language: string
  links: {
    privacy_policy: string
    user_agreement: string
    docs: string
  }
}

export interface ContactSalesPayload {
  name: string
  email: string
  company?: string
  region: string
  use_case: string
  monthly_volume?: string
  required_models?: string
  message?: string
  redirect?: string
}

export interface ContactSalesResult {
  id: number
}

// 营销站配置（复用后端 /api/status 已公开的 system_name/logo/footer_html）。
export async function getSiteConfig(): Promise<SiteConfig | null> {
  const res = await api
    .get<ApiEnvelope<SiteConfig>>('/api/public/site-config', {
      skipErrorHandler: true,
    })
    .catch(() => null)
  return res?.data?.data ?? null
}

export async function getPricing(locale: string): Promise<MarketingPlan[]> {
  const res = await api
    .get<ApiEnvelope<{ plans: MarketingPlan[] }>>('/api/public/pricing', {
      params: { locale },
      skipErrorHandler: true,
    })
    .catch(() => null)
  return res?.data?.data?.plans ?? []
}

export async function getModelCatalog(locale: string): Promise<ModelCategory[]> {
  const res = await api
    .get<ApiEnvelope<{ categories: ModelCategory[] }>>('/api/public/model-catalog', {
      params: { locale },
      skipErrorHandler: true,
    })
    .catch(() => null)
  return res?.data?.data?.categories ?? []
}

export async function submitContactSales(
  payload: ContactSalesPayload,
): Promise<ContactSalesResult | null> {
  const res = await api
    .post<ApiEnvelope<ContactSalesResult>>('/api/public/contact-sales', payload, {
      skipErrorHandler: true,
      skipBusinessError: true,
    })
    .catch(() => null)
  return res?.data?.success ? res.data.data : null
}
