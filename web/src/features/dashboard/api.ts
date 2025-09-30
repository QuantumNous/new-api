import { api } from '@/lib/api'

export interface OpenAISubscriptionResponse {
  object: string
  has_payment_method: boolean
  soft_limit_usd: number
  hard_limit_usd: number
  system_hard_limit_usd: number
  access_until: number
}

export interface OpenAIUsageResponse {
  object: string
  total_usage: number
}

export interface QuotaDataItem {
  id?: number
  user_id?: number
  username?: string
  model_name?: string
  created_at: number
  token_used?: number
  count?: number
  quota?: number
}

export interface UptimeMonitor {
  name: string
  uptime: number
  status: number
  group?: string
}

export interface UptimeGroupResult {
  categoryName: string
  monitors: UptimeMonitor[]
}

export async function getLogsSelfStat(params: {
  start_timestamp: number
  end_timestamp: number
  type?: number
  token_name?: string
  model_name?: string
  channel?: number
  group?: string
}) {
  const res = await api.get<{
    success: boolean
    data: { quota: number; rpm: number; tpm: number; count?: number }
  }>('/api/log/self/stat', { params })
  return res.data
}

export async function getSubscription() {
  const res = await api.get<OpenAISubscriptionResponse>(
    '/dashboard/billing/subscription',
    { skipBusinessError: true as any } as any
  )
  return res.data
}

export async function getUsage() {
  const res = await api.get<OpenAIUsageResponse>('/dashboard/billing/usage', {
    skipBusinessError: true as any,
  } as any)
  return res.data
}

export async function getUserQuotaDates(params: {
  start_timestamp: number
  end_timestamp: number
  model_name?: string
  token_name?: string
}) {
  const res = await api.get<{ success: boolean; data: QuotaDataItem[] }>(
    '/api/data/self',
    { params }
  )
  return res.data
}

export async function getUptimeStatus() {
  const res = await api.get<{ success: boolean; data: UptimeGroupResult[] }>(
    '/api/uptime/status'
  )
  return res.data
}
