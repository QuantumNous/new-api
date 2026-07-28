import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import type {
  EntitlementSummary,
  Plan,
  SubscriptionEntitlement,
  SubscriptionPlan,
  TrafficEntitlement,
  TrafficPlan,
} from '@/types/console'

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
  const trafficPlans = computed<TrafficPlan[]>(
    () => plans.value.filter((plan) => plan.kind === 'traffic') as TrafficPlan[]
  )
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
        api.get<Plan[]>('/api/subscription/plans', undefined, { signal }),
        api.get<EntitlementSummary>('/api/subscription/self', undefined, {
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
    plans.value = planList
    subscription.value = summary.subscription
    trafficPacks.value = summary.traffic
  }

  async function purchase(plan: Plan): Promise<boolean> {
    if (purchasingId.value !== null) return false
    purchasingId.value = plan.id
    try {
      await api.post('/api/subscription/purchase', { plan_id: plan.id })
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
    const previous = subscription.value?.auto_renew
    savingAutoRenew.value = true
    try {
      const summary = await api.put<EntitlementSummary>(
        '/api/subscription/self',
        { auto_renew: enabled }
      )
      subscription.value = summary.subscription
      trafficPacks.value = summary.traffic
      toast.success(enabled ? t('plans.autoRenewOn') : t('plans.autoRenewOff'))
      return true
    } catch (err) {
      // Roll the optimistic switch back so the control never lies about state.
      if (subscription.value && previous !== undefined) {
        subscription.value = { ...subscription.value, auto_renew: previous }
      }
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
