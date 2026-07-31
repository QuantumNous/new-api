import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { HOME_LAUNCHED_AT, HOME_REQUEST_SEED } from '@/constants/home/showcase'
import type { HomeRuntime } from '@/types/homeShowcase'

export function calculateRuntime(
  now: number,
  launchedAt = HOME_LAUNCHED_AT
): HomeRuntime {
  const total = Math.max(0, Math.floor((now - Date.parse(launchedAt)) / 1000))
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  }
}

export function useHomeShowcase() {
  const now = ref(Date.now())
  const demoRequests = ref(HOME_REQUEST_SEED)
  const visible = ref(true)
  let intervalId: number | null = null

  const runtime = computed(() => calculateRuntime(now.value))

  function stopClock() {
    if (intervalId !== null) window.clearInterval(intervalId)
    intervalId = null
  }

  function syncClock() {
    stopClock()
    if (
      !visible.value ||
      document.visibilityState === 'hidden' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    intervalId = window.setInterval(() => {
      now.value = Date.now()
      demoRequests.value += 5
    }, 1_000)
  }

  function setSectionVisible(next: boolean) {
    visible.value = next
    syncClock()
  }

  function handleVisibilityChange() {
    now.value = Date.now()
    syncClock()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    syncClock()
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    stopClock()
  })

  return {
    runtime,
    demoRequests,
    setSectionVisible,
  }
}
