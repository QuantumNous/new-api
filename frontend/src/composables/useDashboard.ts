import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { parseUsageRows, type UsageRow } from '@/api/liveContracts'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

export interface DashboardStats {
  quota: number
  used_quota: number
  today_quota: number
  month_quota?: number
  today_requests: number
  total_requests: number
  month_quota_delta: number
  month_requests_delta: number
}

export interface UserLimits {
  /** Request ceiling from the active subscription plan; 0 = unmetered. */
  rate_limit: number
  current_rpm: number // observed throughput
}

export interface UserDiscounts {
  global_ratio: number // platform-wide pricing multiplier, e.g. 0.88
  plan_ratio: number // active plan's multiplier, e.g. 0.95; 1.0 without a plan
  effective_ratio: number // combined: global × plan
}

export interface ModelShare {
  model: string
  ratio: number
  /** billed spend */
  quota: number
  /** same traffic at list price */
  standard_quota: number
  requests: number
  tokens: number
}

export interface TokenTrendPoint {
  date: string
  input: number
  output: number
  cache_create: number
  cache_read: number
  hit_rate: number
}

export interface SystemMetrics {
  cpu_percent: number | null
  memory_used_gb: number | null
  memory_total_gb: number | null
  bandwidth_up_mbps: number | null
  bandwidth_down_mbps: number | null
  disk_used_gb: number | null
  disk_total_gb: number | null
  api_success_rate: number | null
  /** Recent throughput samples, oldest → newest; the last pair is the live figure. */
  bandwidth_series: { up: number[]; down: number[] } | null
}

export interface FlowPoint {
  date: string
  consume: number
  requests: number
  topup: number
}

const DAY_SECONDS = 86_400
const MAX_SELF_USAGE_RANGE_SECONDS = 30 * DAY_SECONDS

export function getLocalDayStartTimestamp(now = new Date()): number {
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000
  )
}

export function getLocalMonthStartTimestamp(now = new Date()): number {
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
}

function splitUsageRange(
  startTimestamp: number,
  endTimestamp: number
): Array<{ start_timestamp: number; end_timestamp: number }> {
  if (endTimestamp < startTimestamp) return []

  const ranges: Array<{
    start_timestamp: number
    end_timestamp: number
  }> = []
  let nextStart = startTimestamp
  while (nextStart <= endTimestamp) {
    const nextEnd = Math.min(
      endTimestamp,
      nextStart + MAX_SELF_USAGE_RANGE_SECONDS - 1
    )
    ranges.push({ start_timestamp: nextStart, end_timestamp: nextEnd })
    nextStart = nextEnd + 1
  }
  return ranges
}

export async function fetchSelfUsage(
  startTimestamp: number,
  endTimestamp: number,
  signal?: AbortSignal
): Promise<UsageRow[]> {
  const ranges = splitUsageRange(startTimestamp, endTimestamp)
  const responses = await Promise.all(
    ranges.map(({ start_timestamp, end_timestamp }) =>
      api.get<unknown>(
        '/api/data/self',
        { start_timestamp, end_timestamp },
        signal ? { signal } : undefined
      )
    )
  )
  return responses.flatMap(parseUsageRows)
}

/** Balance visibility preference, shared across dashboard & wallet. */
export function useBalanceVisibility() {
  const hidden = useLocalStorage('renren_hide_balance', false)
  return { hidden, toggle: () => (hidden.value = !hidden.value) }
}

export function useDashboard() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()
  const loading = ref(true)
  const stats = ref<DashboardStats | null>(null)
  const share = ref<ModelShare[]>([])
  const flow = ref<FlowPoint[]>([])
  const tokenTrend = ref<TokenTrendPoint[]>([])
  const system = ref<SystemMetrics | null>(null)
  const limits = ref<UserLimits | null>(null)
  const discounts = ref<UserDiscounts | null>(null)

  async function loadSystem() {
    const result = await Promise.allSettled([
      api.get<SystemMetrics>('/api/next/dashboard/system-status'),
    ])
    system.value = result[0]?.status === 'fulfilled' ? result[0].value : null
  }

  async function load() {
    loading.value = true
    try {
      {
        const endTimestamp = Math.floor(Date.now() / 1000)
        const startTimestamp = endTimestamp - 29 * DAY_SECONDS
        const monthStartTimestamp = getLocalMonthStartTimestamp()
        const [usage, trendResponse, monthUsage] = await Promise.all([
          fetchSelfUsage(startTimestamp, endTimestamp),
          api.get<TokenTrendPoint[]>('/api/next/dashboard/token-trend', {
            range: '30d',
            tz_offset: String(-new Date().getTimezoneOffset()),
          }),
          fetchSelfUsage(monthStartTimestamp, endTimestamp),
        ])
        const previousResult = await Promise.allSettled([
          fetchSelfUsage(startTimestamp - 30 * DAY_SECONDS, startTimestamp - 1),
        ])
        const previousUsage =
          previousResult[0]?.status === 'fulfilled'
            ? previousResult[0].value
            : []
        const todayStart = getLocalDayStartTimestamp()
        const totalQuota = usage.reduce((sum, row) => sum + row.quota, 0)
        const totalRequests = usage.reduce((sum, row) => sum + row.count, 0)
        const previousQuota = previousUsage.reduce(
          (sum, row) => sum + row.quota,
          0
        )
        const previousRequests = previousUsage.reduce(
          (sum, row) => sum + row.count,
          0
        )
        stats.value = {
          quota: auth.user?.quota ?? 0,
          used_quota: auth.user?.used_quota ?? 0,
          today_quota: usage
            .filter((row) => row.created_at >= todayStart)
            .reduce((sum, row) => sum + row.quota, 0),
          month_quota: monthUsage.reduce((sum, row) => sum + row.quota, 0),
          today_requests: usage
            .filter((row) => row.created_at >= todayStart)
            .reduce((sum, row) => sum + row.count, 0),
          total_requests: totalRequests,
          month_quota_delta:
            previousQuota > 0
              ? ((totalQuota - previousQuota) / previousQuota) * 100
              : 0,
          month_requests_delta:
            previousRequests > 0
              ? ((totalRequests - previousRequests) / previousRequests) * 100
              : 0,
        }
        const modelRows = new Map<string, ModelShare>()
        const dayRows = new Map<string, FlowPoint>()
        for (const row of usage) {
          const current = modelRows.get(row.model_name) ?? {
            model: row.model_name,
            ratio: 1,
            quota: 0,
            standard_quota: 0,
            requests: 0,
            tokens: 0,
          }
          current.quota += row.quota
          current.standard_quota += row.quota
          current.requests += row.count
          current.tokens += row.token_used
          modelRows.set(row.model_name, current)

          const date = new Date(row.created_at * 1000)
            .toISOString()
            .slice(0, 10)
          const day = dayRows.get(date) ?? {
            date,
            consume: 0,
            requests: 0,
            topup: 0,
          }
          day.consume += row.quota
          day.requests += row.count
          dayRows.set(date, day)
        }
        share.value = [...modelRows.values()].map((row) => ({
          ...row,
          ratio: totalQuota > 0 ? row.quota / totalQuota : 0,
        }))
        flow.value = [...dayRows.values()].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
        tokenTrend.value = trendResponse
        await loadSystem()
        limits.value = null
        discounts.value = null
        return
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    stats,
    share,
    flow,
    tokenTrend,
    system,
    limits,
    discounts,
    loadSystem,
    load,
  }
}
