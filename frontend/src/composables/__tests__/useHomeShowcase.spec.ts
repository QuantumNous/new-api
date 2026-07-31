import { describe, expect, it } from 'vitest'

import { calculateRuntime } from '@/composables/useHomeShowcase'

describe('home runtime calculations', () => {
  it('calculates stable runtime from the public launch date', () => {
    expect(
      calculateRuntime(new Date('2026-03-16T01:02:03+08:00').getTime())
    ).toEqual({ days: 1, hours: 1, minutes: 2, seconds: 3 })
  })
})
