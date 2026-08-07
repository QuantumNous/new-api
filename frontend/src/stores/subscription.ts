import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

import type {
  Plan,
  SubscriptionEntitlement,
  TrafficEntitlement,
} from '@/types/console'
import { useAuthStore } from './auth'

export interface SubscriptionSnapshot {
  plans: Plan[]
  subscription: SubscriptionEntitlement | null
  trafficPacks: TrafficEntitlement[]
}

const CACHE_TTL_MS = 60_000

export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const plans = ref<Plan[]>([])
  const subscription = ref<SubscriptionEntitlement | null>(null)
  const trafficPacks = ref<TrafficEntitlement[]>([])
  const loading = ref(true)
  const error = ref<unknown>(null)
  const loadedAt = ref(0)
  const loadedUserId = ref<number | null>(null)
  let inflight: Promise<void> | null = null
  let inflightUserId: number | null | undefined
  let revision = 0

  function clearState(preserveLoading = false): void {
    revision += 1
    plans.value = []
    subscription.value = null
    trafficPacks.value = []
    error.value = null
    loadedAt.value = 0
    loadedUserId.value = null
    if (!preserveLoading) loading.value = true
  }

  function reset(): void {
    inflight = null
    inflightUserId = undefined
    clearState()
  }

  function invalidate(): void {
    loadedAt.value = 0
  }

  async function load(
    userId: number | null,
    loader: () => Promise<SubscriptionSnapshot>,
    options: { force?: boolean } = {}
  ): Promise<void> {
    if (inflight && inflightUserId !== userId) reset()
    if (loadedUserId.value !== null && loadedUserId.value !== userId) {
      reset()
    }
    const fresh =
      !options.force &&
      loadedUserId.value === userId &&
      loadedAt.value > 0 &&
      Date.now() - loadedAt.value < CACHE_TTL_MS
    if (fresh) return
    if (inflight) return inflight

    const activeRevision = revision
    const task = (async () => {
      loading.value = true
      error.value = null
      try {
        const snapshot = await loader()
        if (revision !== activeRevision) return
        plans.value = snapshot.plans
        subscription.value = snapshot.subscription
        trafficPacks.value = snapshot.trafficPacks
        loadedUserId.value = userId
        loadedAt.value = Date.now()
      } catch (cause) {
        if (revision === activeRevision) {
          error.value = cause
          loadedAt.value = 0
        }
        throw cause
      } finally {
        if (revision === activeRevision) loading.value = false
      }
    })()
    inflight = task
    inflightUserId = userId
    task.then(
      () => {
        if (inflight === task) {
          inflight = null
          inflightUserId = undefined
        }
      },
      () => {
        if (inflight === task) {
          inflight = null
          inflightUserId = undefined
        }
      }
    )
    return task
  }

  function setEntitlements(
    nextSubscription: SubscriptionEntitlement | null,
    nextTrafficPacks: TrafficEntitlement[]
  ): void {
    subscription.value = nextSubscription
    trafficPacks.value = nextTrafficPacks
  }

  watch(
    () => auth.user?.id ?? null,
    (nextUserId, previousUserId) => {
      if (
        previousUserId !== undefined &&
        nextUserId !== previousUserId &&
        loadedUserId.value !== null
      ) {
        reset()
      }
    }
  )

  return {
    plans,
    subscription,
    trafficPacks,
    loading,
    error,
    loadedAt,
    loadedUserId,
    load,
    invalidate,
    reset,
    setEntitlements,
  }
})
