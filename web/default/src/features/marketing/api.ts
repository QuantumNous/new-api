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

export type AnalyticsEventName =
  | 'visit'
  | 'signup'
  | 'pricing_click'
  | 'lead_submit'
  | 'page_view'

// 埋点上报（P1-06）。失败静默忽略，不影响主流程。
export async function trackEvent(
  event: AnalyticsEventName,
  extra?: { path?: string; locale?: string; referrer?: string },
): Promise<void> {
  await api
    .post(
      '/api/public/track',
      {
        event,
        path: extra?.path ?? (typeof window !== 'undefined' ? window.location.pathname : ''),
        locale: extra?.locale,
        referrer:
          extra?.referrer ??
          (typeof document !== 'undefined' ? document.referrer : ''),
      },
      { skipErrorHandler: true, skipBusinessError: true },
    )
    .catch(() => {})
}
