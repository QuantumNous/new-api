import { computed, getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

import type { HomeRuntime } from '@/types/homeShowcase'

export function calculateRuntime(
  now: number,
  launchedAt?: string | number
): HomeRuntime {
  const timestamp =
    typeof launchedAt === 'number'
      ? launchedAt * 1000
      : launchedAt
        ? Date.parse(launchedAt)
        : Number.NaN
  const total = Number.isFinite(timestamp)
    ? Math.max(0, Math.floor((now - timestamp) / 1000))
    : 0
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  }
}

export function useHomeShowcase(startTime?: Readonly<Ref<number | null>>) {
  const now = ref(Date.now())
  const sectionVisible = ref(true)
  let intervalId: number | null = null
  let disposed = false

  const runtime = computed(() =>
    calculateRuntime(now.value, startTime?.value ?? undefined)
  )

  function stopClock() {
    if (intervalId !== null) window.clearInterval(intervalId)
    intervalId = null
  }

  function syncClock() {
    if (
      disposed ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return
    }

    stopClock()
    if (
      !sectionVisible.value ||
      document.visibilityState === 'hidden' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    intervalId = window.setInterval(() => {
      now.value = Date.now()
    }, 1_000)
  }

  function setSectionVisible(next: boolean) {
    sectionVisible.value = next
    syncClock()
  }

  function handleVisibilityChange() {
    now.value = Date.now()
    syncClock()
  }

  function dispose() {
    if (disposed) return
    disposed = true
    stopClock()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    syncClock()
  }
  if (getCurrentScope()) onScopeDispose(dispose)

  return {
    runtime,
    setSectionVisible,
    dispose,
  }
}
