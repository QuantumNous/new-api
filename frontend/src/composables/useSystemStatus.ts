import { getCurrentScope, onScopeDispose, ref } from 'vue'

import { getSystemStatus, type SystemStatusSnapshot } from '@/api/systemStatus'

const SYSTEM_STATUS_POLL_MS = 10_000
const SYSTEM_STATUS_STALE_MS = 30_000

export type SystemServiceState = 'online' | 'degraded' | 'offline'

interface UseSystemStatusOptions {
  loader?: (signal?: AbortSignal) => Promise<SystemStatusSnapshot>
  now?: () => number
}

export function useSystemStatus(options: UseSystemStatusOptions = {}) {
  const metrics = ref<SystemStatusSnapshot | null>(null)
  const serviceState = ref<SystemServiceState>('offline')
  const loading = ref(false)
  const loader = options.loader ?? getSystemStatus
  const now = options.now ?? Date.now

  let lastSnapshot: SystemStatusSnapshot | null = null
  let lastSuccessfulAt: number | null = null
  let lastRequestFailed = false
  let requestController: AbortController | null = null
  let requestGeneration = 0
  let pollTimerId: number | null = null
  let staleTimerId: number | null = null
  let disposed = false

  function isVisible(): boolean {
    return (
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
    )
  }

  function clearPollTimer(): void {
    if (pollTimerId !== null) window.clearTimeout(pollTimerId)
    pollTimerId = null
  }

  function clearStaleTimer(): void {
    if (staleTimerId !== null) window.clearTimeout(staleTimerId)
    staleTimerId = null
  }

  function applyState(at: number): void {
    if (
      lastSnapshot === null ||
      lastSuccessfulAt === null ||
      at - lastSuccessfulAt > SYSTEM_STATUS_STALE_MS
    ) {
      metrics.value = null
      serviceState.value = 'offline'
      return
    }
    metrics.value = lastSnapshot
    serviceState.value =
      lastRequestFailed || lastSnapshot.status === 'degraded'
        ? 'degraded'
        : 'online'
  }

  function scheduleStaleCheck(): void {
    clearStaleTimer()
    if (lastSuccessfulAt === null || disposed || typeof window === 'undefined')
      return
    const delay = Math.max(
      0,
      lastSuccessfulAt + SYSTEM_STATUS_STALE_MS - now() + 1
    )
    staleTimerId = window.setTimeout(() => {
      staleTimerId = null
      applyState(now())
    }, delay)
  }

  function schedulePoll(): void {
    clearPollTimer()
    if (disposed || !isVisible() || typeof window === 'undefined') return
    pollTimerId = window.setTimeout(() => {
      pollTimerId = null
      void refresh()
    }, SYSTEM_STATUS_POLL_MS)
  }

  function cancelRequest(): void {
    requestGeneration += 1
    requestController?.abort()
    requestController = null
    loading.value = false
  }

  async function refresh(): Promise<void> {
    if (disposed || !isVisible() || requestController !== null) return
    clearPollTimer()
    const controller = new AbortController()
    const generation = ++requestGeneration
    requestController = controller
    loading.value = true
    try {
      const snapshot = await loader(controller.signal)
      if (
        disposed ||
        controller.signal.aborted ||
        generation !== requestGeneration ||
        requestController !== controller
      )
        return
      lastSnapshot = snapshot
      lastSuccessfulAt = now()
      lastRequestFailed = false
      applyState(lastSuccessfulAt)
      scheduleStaleCheck()
    } catch {
      if (
        disposed ||
        controller.signal.aborted ||
        generation !== requestGeneration ||
        requestController !== controller
      )
        return
      lastRequestFailed = true
      applyState(now())
      scheduleStaleCheck()
    } finally {
      if (requestController === controller) {
        requestController = null
        loading.value = false
        schedulePoll()
      }
    }
  }

  function handleVisibilityChange(): void {
    clearPollTimer()
    clearStaleTimer()
    cancelRequest()
    if (!isVisible()) return
    applyState(now())
    scheduleStaleCheck()
    void refresh()
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    clearPollTimer()
    clearStaleTimer()
    cancelRequest()
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', handleVisibilityChange)
  }

  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', handleVisibilityChange)
  if (isVisible()) void refresh()
  if (getCurrentScope()) onScopeDispose(dispose)

  return { metrics, serviceState, loading, refresh, dispose }
}
