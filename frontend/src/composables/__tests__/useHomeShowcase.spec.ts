import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  calculateRuntime,
  useHomeShowcase,
} from '@/composables/useHomeShowcase'
import { HOME_REQUEST_SEED } from '@/constants/home/showcase'

afterEach(() => {
  vi.useRealTimers()
})

describe('home runtime calculations', () => {
  it('calculates stable runtime from the public launch date', () => {
    expect(
      calculateRuntime(new Date('2026-03-16T01:02:03+08:00').getTime())
    ).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3 })
  })

  it('updates runtime and request totals only while the section is visible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T01:02:03+08:00'))
    const state = useHomeShowcase()

    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED)
    expect(state.runtime.value.seconds).toBe(3)

    vi.advanceTimersByTime(1_000)
    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED + 5)
    expect(state.runtime.value.seconds).toBe(4)

    state.setSectionVisible(false)
    vi.advanceTimersByTime(2_000)
    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED + 5)
    expect(state.runtime.value.seconds).toBe(4)

    state.setSectionVisible(true)
    vi.advanceTimersByTime(1_000)
    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED + 10)
    expect(state.runtime.value.seconds).toBe(7)

    state.dispose()
  })

  it('stops all updates after disposal', () => {
    vi.useFakeTimers()
    const state = useHomeShowcase()

    state.dispose()
    vi.advanceTimersByTime(2_000)

    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED)
  })

  it('pauses while the document is hidden and resumes after visibility returns', () => {
    vi.useFakeTimers()
    const originalVisibility = document.visibilityState
    const state = useHomeShowcase()

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_000)
    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1_000)
    expect(state.demoRequests.value).toBe(HOME_REQUEST_SEED + 5)

    state.dispose()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: originalVisibility,
    })
  })
})
