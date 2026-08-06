import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { isMockApi } from '@/api/client'
import { ApiError } from '@/api/types'
import {
  invalidResponse,
  isRecord,
  requiredInteger,
  requiredNumber,
  requiredString,
} from '@/api/contracts'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import type {
  Duration,
  DurationUnit,
  Plan,
  SubscriptionEntitlement,
  SubscriptionPlan,
  TrafficEntitlement,
  TrafficPlan,
} from '@/types/console'

interface BackendPlan {
  id: number
  title: string
  price_amount: number
  currency?: string
  duration_unit?: string
  duration_value?: number
  custom_seconds?: number
  total_amount?: number
  quota_reset_period?: string
  enabled?: boolean
  allow_balance_pay?: boolean
  subtitle?: string
  quota_reset_custom_seconds?: number
}

interface BackendSubscription {
  id: number
  plan_id: number
  amount_total: number
  amount_used: number
  start_time: number
  end_time: number
  last_reset_time: number
  next_reset_time: number
  status: string
}

interface BackendSubscriptionSelf {
  subscriptions?: Array<{ subscription: BackendSubscription }>
  billing_preference?: string
}

function duration(
  unit: string | undefined,
  value = 1,
  customSeconds = 0
): Duration {
  const normalized: DurationUnit =
    unit === 'hour' ||
    unit === 'day' ||
    unit === 'week' ||
    unit === 'month' ||
    unit === 'year'
      ? unit
      : 'custom'
  return normalized === 'custom'
    ? { value: Math.max(1, customSeconds), unit: normalized }
    : { value: Math.max(1, value), unit: normalized }
}

export function toPlan(raw: BackendPlan): SubscriptionPlan {
  const term = duration(
    raw.duration_unit,
    raw.duration_value,
    raw.custom_seconds
  )
  const period =
    raw.quota_reset_period === 'never'
      ? term
      : raw.quota_reset_period === 'daily'
        ? duration('day')
        : raw.quota_reset_period === 'weekly'
          ? duration('week')
          : raw.quota_reset_period === 'monthly'
            ? duration('month')
            : duration('custom', 1, raw.quota_reset_custom_seconds)
  return {
    id: raw.id,
    name: raw.title,
    price: raw.price_amount,
    features: raw.subtitle ? [raw.subtitle] : [],
    accent: { token: 'accent' },
    exclusive_channel_id: null,
    kind: 'subscription',
    period,
    meter: 'cap',
    period_quota: raw.total_amount ?? 0,
    term,
    balance_pay_enabled: raw.allow_balance_pay !== false,
  }
}

export function toEntitlement(
  raw: BackendSubscription | undefined,
  plan: SubscriptionPlan | undefined
): SubscriptionEntitlement | null {
  if (!raw) return null
  return {
    plan_id: raw.plan_id,
    name: plan?.name ?? `订阅 #${raw.plan_id}`,
    meter: plan?.meter ?? 'cap',
    period:
      plan?.period ??
      duration(
        'custom',
        1,
        Math.max(1, raw.next_reset_time - raw.last_reset_time)
      ),
    period_quota: raw.amount_total,
    period_used: raw.amount_used,
    period_start: raw.last_reset_time || raw.start_time,
    period_end: raw.next_reset_time || raw.end_time,
    expire_time: raw.end_time,
    auto_renew: false,
    accent: plan?.accent ?? { token: 'accent' },
  }
}

export function parseBackendPlan(value: unknown): BackendPlan {
  const endpoint = '/api/subscription/plans'
  if (!isRecord(value)) invalidResponse(endpoint)
  const allowBalancePay = value.allow_balance_pay
  if (allowBalancePay !== undefined && typeof allowBalancePay !== 'boolean') {
    invalidResponse(endpoint)
  }
  return {
    id: requiredInteger(value.id, endpoint),
    title: requiredString(value.title, endpoint, false),
    subtitle: requiredString(value.subtitle ?? '', endpoint),
    price_amount: requiredNumber(value.price_amount, endpoint),
    currency: requiredString(value.currency ?? 'USD', endpoint),
    duration_unit: requiredString(value.duration_unit, endpoint, false),
    duration_value: requiredInteger(value.duration_value, endpoint),
    custom_seconds: requiredInteger(value.custom_seconds ?? 0, endpoint),
    total_amount: requiredInteger(value.total_amount, endpoint),
    quota_reset_period: requiredString(
      value.quota_reset_period,
      endpoint,
      false
    ),
    quota_reset_custom_seconds: requiredInteger(
      value.quota_reset_custom_seconds ?? 0,
      endpoint
    ),
    allow_balance_pay: allowBalancePay as boolean | undefined,
  }
}

export function parseBackendSubscription(value: unknown): BackendSubscription {
  const endpoint = '/api/subscription/self'
  if (!isRecord(value)) invalidResponse(endpoint)
  return {
    id: requiredInteger(value.id, endpoint),
    plan_id: requiredInteger(value.plan_id, endpoint),
    amount_total: requiredInteger(value.amount_total, endpoint),
    amount_used: requiredInteger(value.amount_used, endpoint),
    start_time: requiredInteger(value.start_time, endpoint),
    end_time: requiredInteger(value.end_time, endpoint),
    last_reset_time: requiredInteger(value.last_reset_time, endpoint),
    next_reset_time: requiredInteger(value.next_reset_time, endpoint),
    status: requiredString(value.status, endpoint, false),
  }
}

/**
 * Storefront side of the plan catalogue: the caller's entitlements plus the
 * purchasable plans. Shelf state is resolved server-side, so anything that
 * arrives here is buyable.
 */
export function useSubscription() {
  const { t } = useI18n()
  const toast = useToast()

  const plans = ref<Plan[]>([])
  const subscription = ref<SubscriptionEntitlement | null>(null)
  const trafficPacks = ref<TrafficEntitlement[]>([])
  const loading = ref(true)
  const purchasingId = ref<number | null>(null)
  const savingAutoRenew = ref(false)
  const initialError = ref('')
  const request = useLatestRequest()

  /** Split once here so both sections render from a stable, typed list. */
  const trafficPlans = computed<TrafficPlan[]>(() => [])
  const subscriptionPlans = computed<SubscriptionPlan[]>(
    () =>
      plans.value.filter(
        (plan) => plan.kind === 'subscription'
      ) as SubscriptionPlan[]
  )

  async function load(): Promise<void> {
    loading.value = true
    initialError.value = ''
    const result = await request.run((signal) =>
      Promise.all([
        api.get<Array<{ plan: BackendPlan }>>(
          '/api/subscription/plans',
          undefined,
          { signal }
        ),
        api.get<BackendSubscriptionSelf>('/api/subscription/self', undefined, {
          signal,
        }),
      ])
    )
    if (result.stale) return
    loading.value = false
    if (!result.ok) {
      initialError.value =
        result.error instanceof ApiError
          ? result.error.message
          : t('plans.loadFailed')
      return
    }
    const [planList, summary] = result.value
    if (!isMockApi) {
      if (!Array.isArray(planList) || !isRecord(summary)) {
        invalidResponse('/api/subscription/self')
      }
      plans.value = planList.map((row) => {
        if (!isRecord(row) || !isRecord(row.plan)) {
          invalidResponse('/api/subscription/plans')
        }
        return toPlan(parseBackendPlan(row.plan))
      })
      if (!Array.isArray(summary.subscriptions)) {
        invalidResponse('/api/subscription/self')
      }
      const subscriptions = summary.subscriptions.map((row) => {
        if (!isRecord(row) || !isRecord(row.subscription)) {
          invalidResponse('/api/subscription/self')
        }
        return parseBackendSubscription(row.subscription)
      })
      const current = subscriptions.find((item) => item.status === 'active')
      subscription.value = toEntitlement(
        current,
        plans.value.find((plan) => plan.id === current?.plan_id) as
          SubscriptionPlan | undefined
      )
      trafficPacks.value = []
      return
    }
    const rawPlanRows = planList as unknown as Array<
      { plan?: BackendPlan } & Record<string, unknown>
    >
    plans.value = rawPlanRows.some((row) => row.plan)
      ? rawPlanRows.map((row) => toPlan(row.plan as BackendPlan))
      : (planList as unknown as Plan[])
    const legacySummary = summary as BackendSubscriptionSelf & {
      subscription?: SubscriptionEntitlement | null
      traffic?: TrafficEntitlement[]
    }
    if (legacySummary.subscription !== undefined || legacySummary.traffic) {
      subscription.value = legacySummary.subscription ?? null
      trafficPacks.value = legacySummary.traffic ?? []
    } else {
      const current = summary.subscriptions
        ?.map((item) => item.subscription)
        .find((item) => item.status === 'active')
      subscription.value = toEntitlement(
        current,
        plans.value.find((plan) => plan.id === current?.plan_id) as
          SubscriptionPlan | undefined
      )
      trafficPacks.value = []
    }
  }

  async function purchase(plan: Plan): Promise<boolean> {
    if (purchasingId.value !== null) return false
    purchasingId.value = plan.id
    try {
      await api.post(
        isMockApi
          ? '/api/subscription/purchase'
          : '/api/subscription/balance/pay',
        { plan_id: plan.id }
      )
      toast.success(t('plans.purchased'))
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      purchasingId.value = null
    }
  }

  async function setAutoRenew(enabled: boolean): Promise<boolean> {
    if (!isMockApi) return false
    savingAutoRenew.value = true
    try {
      const summary = await api.put<{
        subscription: SubscriptionEntitlement | null
        traffic: TrafficEntitlement[]
      }>('/api/subscription/self', { auto_renew: enabled })
      subscription.value = summary.subscription
      trafficPacks.value = summary.traffic
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err))
      return false
    } finally {
      savingAutoRenew.value = false
    }
  }

  return {
    plans,
    trafficPlans,
    subscriptionPlans,
    subscription,
    trafficPacks,
    loading,
    purchasingId,
    savingAutoRenew,
    initialError,
    load,
    purchase,
    setAutoRenew,
  }
}
