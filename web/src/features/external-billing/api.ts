/* External billing API: per-user external (third-party) channel usage. */
import { api } from '@/lib/api'

export interface ExternalBillingRow {
  username: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  quota: number
  model_count: number
}

export interface ExternalBillingResponse {
  success: boolean
  message: string
  data: ExternalBillingRow[]
}

function buildParams(startTimestamp: number, endTimestamp: number, username?: string) {
  const p: Record<string, number | string> = {}
  if (startTimestamp) p.start_timestamp = startTimestamp
  if (endTimestamp) p.end_timestamp = endTimestamp
  if (username) p.username = username
  return p
}

/** Admin: all users' external usage. */
export async function fetchExternalBilling(
  startTimestamp: number,
  endTimestamp: number,
  username?: string
): Promise<ExternalBillingResponse> {
  const res = await api.get('/api/log/stat/external', {
    params: buildParams(startTimestamp, endTimestamp, username),
  })
  return res.data
}

/** Member: own external usage. */
export async function fetchExternalBillingSelf(
  startTimestamp: number,
  endTimestamp: number
): Promise<ExternalBillingResponse> {
  const res = await api.get('/api/log/self/stat/external', {
    params: buildParams(startTimestamp, endTimestamp),
  })
  return res.data
}

export const QUOTA_PER_USD = 500000
