import { api } from '@/lib/api'
import type { CacheStats } from './types'

export async function getCacheStats(): Promise<{
  success: boolean
  message?: string
  data?: CacheStats
}> {
  const res = await api.get('/api/option/channel_affinity_cache', {
    disableDuplicate: true,
  } as Record<string, unknown>)
  return res.data
}

export async function clearAllCache(): Promise<{
  success: boolean
  message?: string
}> {
  const res = await api.delete('/api/option/channel_affinity_cache', {
    params: { all: true },
  })
  return res.data
}

export async function clearRuleCache(
  ruleName: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete('/api/option/channel_affinity_cache', {
    params: { rule_name: ruleName },
  })
  return res.data
}

export async function getAffinityUsageCache(params: {
  rule_name: string
  using_group: string
  key_hint: string
  key_fp: string
}): Promise<{ success: boolean; message?: string; data?: unknown }> {
  const res = await api.get('/api/log/channel_affinity_usage_cache', {
    params,
    disableDuplicate: true,
  } as Record<string, unknown>)
  return res.data
}
