import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'

export interface DashboardStats {
  quota: number
  used_quota: number
  today_quota: number
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
  actual: number
  standard: number
}

export interface SystemMetrics {
  cpu_percent: number
  memory_used_gb: number
  memory_total_gb: number
  bandwidth_up_mbps: number
  bandwidth_down_mbps: number
  disk_used_gb: number
  disk_total_gb: number
  api_success_rate: number
  /** Recent throughput samples, oldest → newest; the last pair is the live figure. */
  bandwidth_series: { up: number[]; down: number[] }
}

export interface FlowPoint {
  date: string
  consume: number
  requests: number
  topup: number
}

/** Balance visibility preference, shared across dashboard & wallet. */
export function useBalanceVisibility() {
  const hidden = useLocalStorage('renren_hide_balance', false)
  return { hidden, toggle: () => (hidden.value = !hidden.value) }
}

export function useDashboard() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(true)
  const stats = ref<DashboardStats | null>(null)
  const share = ref<ModelShare[]>([])
  const flow = ref<FlowPoint[]>([])
  const tokenTrend = ref<TokenTrendPoint[]>([])
  const system = ref<SystemMetrics | null>(null)
  const limits = ref<UserLimits | null>(null)
  const discounts = ref<UserDiscounts | null>(null)

  async function load() {
    loading.value = true
    try {
      const [dataSelf, flowSelf, tokensSelf, systemSelf] = await Promise.all([
        api.get<
          DashboardStats & {
            model_share: ModelShare[]
            limits: UserLimits
            discounts: UserDiscounts
          }
        >('/api/data/self'),
        api.get<FlowPoint[]>('/api/data/flow/self'),
        api.get<TokenTrendPoint[]>('/api/data/tokens'),
        api.get<SystemMetrics>('/api/data/system'),
      ])
      const { model_share, limits: lim, discounts: disc, ...rest } = dataSelf
      stats.value = rest
      share.value = model_share
      limits.value = lim
      discounts.value = disc
      flow.value = flowSelf
      tokenTrend.value = tokensSelf
      system.value = systemSelf
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
    load,
  }
}
