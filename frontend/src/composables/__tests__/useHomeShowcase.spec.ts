import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  calculateRuntime,
  useHomeShowcase,
} from '@/composables/useHomeShowcase'

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
})
