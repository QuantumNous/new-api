import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import type { FlowPoint } from '@/composables/useDashboard'

export type StatsRange = 'today' | '7d' | '30d' | 'custom'

export interface StatsKpi {
  totalTokens: number
  totalQuota: number
  totalRequests: number
  avgLatency: number
  successRate: number
}

export interface StatsModelRow {
  model: string
  tokens: number
  quota: number
  requests: number
  share: number
  avgLatency: number
}

export interface HourlyPoint {
  hour: string
  requests: number
}

export interface StatsPeriod {
  kpi: StatsKpi
  models: StatsModelRow[]
  hourly: HourlyPoint[]
  flow: FlowPoint[]
}

export function useDashboardStats() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(false)
  const range = ref<StatsRange>('30d')
  const customStart = ref<string>('')
  const customEnd = ref<string>('')
  const data = ref<StatsPeriod | null>(null)
  const statsRequest = useLatestRequest()

  async function load() {
    loading.value = true
    const params: Record<string, string> = { range: range.value }
    if (range.value === 'custom') {
      params.start = customStart.value
      params.end = customEnd.value
    }
    // Serialized via useLatestRequest: rapid range switches abort the older
    // request, and a late response can never overwrite the newer period.
    const result = await statsRequest.run((signal) =>
      api.get<StatsPeriod>('/api/data/stats', params, { signal })
    )
    if (result.stale) return
    loading.value = false
    if (!result.ok) {
      toast.error(
        result.error instanceof ApiError
          ? result.error.message
          : t('common.failed')
      )
      return
    }
    data.value = result.value
  }

  return { loading, range, customStart, customEnd, data, load }
}
