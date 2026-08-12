import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { HomeRequestMetrics } from '@/api/public'
import {
  calculateRuntime,
  useHomeShowcase,
} from '@/composables/useHomeShowcase'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('home runtime calculations', () => {
  it('calculates stable runtime from a backend start timestamp', () => {
    expect(
      calculateRuntime(
        new Date('2026-03-16T01:02:03+08:00').getTime(),
        new Date('2026-03-15T00:00:00+08:00').getTime() / 1000
      )
    ).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3 })
  })

  it('updates runtime only while the section is visible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T01:02:03+08:00'))
    const state = useHomeShowcase(
      ref(Date.parse('2026-03-15T00:00:00+08:00') / 1000)
    )

    expect(state.runtime.value.seconds).toBe(3)

    vi.advanceTimersByTime(1_000)
    expect(state.runtime.value.seconds).toBe(4)

    state.setSectionVisible(false)
    vi.advanceTimersByTime(2_000)
    expect(state.runtime.value.seconds).toBe(4)

    state.setSectionVisible(true)
    vi.advanceTimersByTime(1_000)
    expect(state.runtime.value.seconds).toBe(7)

    state.dispose()
  })

  it('stops all updates after disposal', () => {
    vi.useFakeTimers()
    const state = useHomeShowcase()

    state.dispose()
    vi.advanceTimersByTime(2_000)

    expect(state.runtime.value.seconds).toBe(0)
  })

  it('pauses while the document is hidden and resumes after visibility returns', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T01:02:03+08:00'))
    const originalVisibility = document.visibilityState
    const state = useHomeShowcase(
      ref(Date.parse('2026-03-15T00:00:00+08:00') / 1000)
    )

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_000)
    expect(state.runtime.value.seconds).toBe(3)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_000)
    expect(state.runtime.value.seconds).toBe(5)

    state.dispose()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: originalVisibility,
    })
  })

  it('loads metrics on visibility and refreshes at most every 60 seconds', async () => {
    vi.useFakeTimers()
    const snapshot = {
      available: true,
      requests_24h: 24,
      hourly_requests: Array(24).fill(1),
      generated_at: 1_700_000_000,
    }
    const metricsLoader = vi.fn(
      async (): Promise<HomeRequestMetrics> => snapshot
    )
    const state = useHomeShowcase(undefined, {
      loadMetrics: true,
      metricsLoader,
    })

    expect(metricsLoader).toHaveBeenCalledTimes(1)
    await Promise.resolve()
    expect(state.requestMetrics.value).toEqual(snapshot)
    state.setSectionVisible(false)
    vi.advanceTimersByTime(10_000)
    state.setSectionVisible(true)
    expect(metricsLoader).toHaveBeenCalledTimes(2)
    await Promise.resolve()
    vi.advanceTimersByTime(59_999)
    expect(metricsLoader).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1)
    expect(metricsLoader).toHaveBeenCalledTimes(3)
    state.dispose()
  })

  it('pauses refresh while hidden and exposes failed refreshes as unavailable', async () => {
    vi.useFakeTimers()
    const snapshot = {
      available: true,
      requests_24h: 24,
      hourly_requests: Array(24).fill(1),
      generated_at: 1_700_000_000,
    }
    let calls = 0
    const metricsLoader = vi.fn(async (): Promise<HomeRequestMetrics> => {
      calls += 1
      if (calls > 1) throw new Error('metrics offline')
      return snapshot
    })
    const state = useHomeShowcase(undefined, {
      loadMetrics: true,
      metricsLoader,
    })
    await Promise.resolve()
    state.setSectionVisible(false)
    vi.advanceTimersByTime(120_000)
    expect(metricsLoader).toHaveBeenCalledTimes(1)
    expect(state.requestMetrics.value).toEqual(snapshot)

    state.setSectionVisible(true)
    await Promise.resolve()
    expect(metricsLoader).toHaveBeenCalledTimes(2)
    expect(state.requestMetrics.value).toBeNull()
    expect(state.metricsError.value).toBeInstanceOf(Error)
    state.dispose()
  })

  it('aborts an in-flight metrics request on disposal', () => {
    const abortSpy = vi.fn()
    const metricsLoader = vi.fn(
      (signal?: AbortSignal): Promise<HomeRequestMetrics> =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => {
            abortSpy()
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
    )
    const state = useHomeShowcase(undefined, {
      loadMetrics: true,
      metricsLoader,
    })
    expect(metricsLoader).toHaveBeenCalledOnce()
    state.dispose()
    expect(abortSpy).toHaveBeenCalledOnce()
  })

  it('ignores an obsolete request that resolves after a newer snapshot', async () => {
    vi.useFakeTimers()
    const first = deferred<HomeRequestMetrics>()
    const second = deferred<HomeRequestMetrics>()
    const firstSnapshot = {
      available: true,
      requests_24h: 24,
      hourly_requests: Array(24).fill(1),
      generated_at: 1_700_000_000,
    }
    const secondSnapshot = {
      available: true,
      requests_24h: 48,
      hourly_requests: Array(24).fill(2),
      generated_at: 1_700_000_060,
    }
    const metricsLoader = vi
      .fn<(_: AbortSignal | undefined) => Promise<HomeRequestMetrics>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const state = useHomeShowcase(undefined, {
      loadMetrics: true,
      metricsLoader,
    })

    state.setSectionVisible(false)
    state.setSectionVisible(true)
    expect(metricsLoader).toHaveBeenCalledTimes(2)

    second.resolve(secondSnapshot)
    await Promise.resolve()
    expect(state.requestMetrics.value).toEqual(secondSnapshot)

    first.resolve(firstSnapshot)
    await Promise.resolve()
    expect(state.requestMetrics.value).toEqual(secondSnapshot)
    state.dispose()
  })

  it('does not write state when an aborted loader ignores disposal', async () => {
    const pending = deferred<HomeRequestMetrics>()
    const state = useHomeShowcase(undefined, {
      loadMetrics: true,
      metricsLoader: () => pending.promise,
    })

    state.dispose()
    pending.resolve({
      available: true,
      requests_24h: 24,
      hourly_requests: Array(24).fill(1),
      generated_at: 1_700_000_000,
    })
    await Promise.resolve()

    expect(state.requestMetrics.value).toBeNull()
    expect(state.metricsError.value).toBeNull()
  })
})
