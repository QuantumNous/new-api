import { computed, getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

import { publicApi, type HomeRequestMetrics } from '@/api/public'
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

export interface HomeShowcaseOptions {
  loadMetrics?: boolean
  metricsLoader?: (signal?: AbortSignal) => Promise<HomeRequestMetrics>
  initiallyVisible?: boolean
}

export function useHomeShowcase(
  startTime?: Readonly<Ref<number | null>>,
  options: HomeShowcaseOptions = {}
) {
  const now = ref(Date.now())
  const sectionVisible = ref(options.initiallyVisible ?? true)
  const requestMetrics = ref<HomeRequestMetrics | null>(null)
  const metricsError = ref<unknown>(null)
  let intervalId: number | null = null
  let metricsIntervalId: number | null = null
  let metricsAbortController: AbortController | null = null
  let disposed = false
  const loadMetrics = options.loadMetrics === true
  const metricsLoader = options.metricsLoader ?? publicApi.homeMetrics

  const runtime = computed(() =>
    calculateRuntime(now.value, startTime?.value ?? undefined)
  )

  function stopClock() {
    if (intervalId !== null) window.clearInterval(intervalId)
    intervalId = null
  }

  function stopMetrics() {
    if (metricsIntervalId !== null) window.clearInterval(metricsIntervalId)
    metricsIntervalId = null
    metricsAbortController?.abort()
    metricsAbortController = null
  }

  async function refreshMetrics() {
    if (!loadMetrics || disposed || !sectionVisible.value) return
    metricsAbortController?.abort()
    const controller = new AbortController()
    metricsAbortController = controller
    metricsError.value = null
    try {
      requestMetrics.value = await metricsLoader(controller.signal)
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        metricsError.value = error
      }
    } finally {
      if (metricsAbortController === controller) metricsAbortController = null
    }
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
    stopMetrics()
    if (!sectionVisible.value || document.visibilityState === 'hidden') {
      return
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      intervalId = window.setInterval(() => {
        now.value = Date.now()
      }, 1_000)
    }
    if (loadMetrics) {
      void refreshMetrics()
      metricsIntervalId = window.setInterval(() => {
        void refreshMetrics()
      }, 60_000)
    }
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
    stopMetrics()
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
    requestMetrics,
    metricsError,
    setSectionVisible,
    dispose,
  }
}
