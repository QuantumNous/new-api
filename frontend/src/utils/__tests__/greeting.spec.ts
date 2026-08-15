import { describe, expect, it } from 'vitest'

import { greetingBucketForHour } from '@/utils/greeting'

describe('greetingBucketForHour', () => {
  it.each([
    [0, 'night'],
    [4, 'night'],
    [5, 'morning'],
    [10, 'morning'],
    [11, 'noon'],
    [12, 'noon'],
    [13, 'afternoon'],
    [17, 'afternoon'],
    [18, 'evening'],
    [22, 'evening'],
    [23, 'night'],
  ])('maps hour %i to %s', (hour, expected) => {
    expect(greetingBucketForHour(hour)).toBe(expected)
  })

  it('falls back to morning when the hour is not a number', () => {
    expect(greetingBucketForHour(Number.NaN)).toBe('morning')
  })
})
