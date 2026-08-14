import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SystemStatusSnapshot } from '@/api/systemStatus'
import { useSystemStatus } from '@/composables/useSystemStatus'

function snapshot(
  status: SystemStatusSnapshot['status'] = 'online'
): SystemStatusSnapshot {
  return {
    status,
    scope: 'current_node',
    sampled_at: 1_786_700_000,
    cpu_percent: status === 'online' ? 34.2 : null,
    memory_used_bytes: 5 * 1024 ** 3,
    memory_total_bytes: 16 * 1024 ** 3,
    disk_used_bytes: 218 * 1024 ** 3,
    disk_total_bytes: 512 * 1024 ** 3,
    network_tx_bytes_per_second: 2_100_000,
    network_rx_bytes_per_second: 12_400_000,
    network_series: [],
    api_success_rate_24h: 99.7,
    version: 'v1.0.0-test',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const originalVisibility = document.visibilityState

afterEach(() => {
  vi.useRealTimers()
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: originalVisibility,
  })
})

describe('useSystemStatus', () => {
  it('loads immediately and polls every ten seconds', async () => {
    vi.useFakeTimers()
    const loader = vi.fn(async () => snapshot())
    const state = useSystemStatus({ loader })
    expect(loader).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(state.serviceState.value).toBe('online')
    expect(state.metrics.value?.version).toBe('v1.0.0-test')
    vi.advanceTimersByTime(9_999)
    expect(loader).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(loader).toHaveBeenCalledTimes(2)
    state.dispose()
  })

  it('never overlaps polling requests', async () => {
    vi.useFakeTimers()
    const first = deferred<SystemStatusSnapshot>()
    const loader = vi
      .fn<(_: AbortSignal | undefined) => Promise<SystemStatusSnapshot>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(snapshot())
    const state = useSystemStatus({ loader })
    vi.advanceTimersByTime(30_000)
    expect(loader).toHaveBeenCalledTimes(1)
    first.resolve(snapshot())
    await flushPromises()
    vi.advanceTimersByTime(10_000)
    expect(loader).toHaveBeenCalledTimes(2)
    state.dispose()
  })

  it('aborts on disposal and resumes immediately after visibility returns', async () => {
    const aborts = vi.fn()
    const loader = vi.fn(
      (signal?: AbortSignal): Promise<SystemStatusSnapshot> =>
        new Promise((_, reject) =>
          signal?.addEventListener('abort', () => {
            aborts()
            reject(new DOMException('aborted', 'AbortError'))
          })
        )
    )
    const state = useSystemStatus({ loader })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(aborts).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(loader).toHaveBeenCalledTimes(2)
    state.dispose()
    expect(aborts).toHaveBeenCalledTimes(2)
    await flushPromises()
  })

  it('keeps a failed sample degraded through 30 seconds, then expires it', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T00:00:00Z'))
    const loader = vi
      .fn<(_: AbortSignal | undefined) => Promise<SystemStatusSnapshot>>()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValue(new Error('offline'))
    const state = useSystemStatus({ loader })
    await flushPromises()
    vi.advanceTimersByTime(10_000)
    await flushPromises()
    expect(state.serviceState.value).toBe('degraded')
    expect(state.metrics.value).not.toBeNull()
    vi.advanceTimersByTime(20_000)
    await flushPromises()
    expect(state.serviceState.value).toBe('degraded')
    vi.advanceTimersByTime(1)
    expect(state.serviceState.value).toBe('offline')
    expect(state.metrics.value).toBeNull()
    state.dispose()
  })

  it('uses the backend degraded state without dropping valid partial data', async () => {
    const loader = vi.fn(async () => snapshot('degraded'))
    const state = useSystemStatus({ loader })
    await flushPromises()
    expect(state.serviceState.value).toBe('degraded')
    expect(state.metrics.value?.cpu_percent).toBeNull()
    state.dispose()
  })
})
