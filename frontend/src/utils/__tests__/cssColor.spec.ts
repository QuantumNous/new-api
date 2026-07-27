import { describe, expect, it } from 'vitest'

import { normalizeOpaqueColor } from '@/utils/cssColor'

describe('normalizeOpaqueColor', () => {
  it.each([
    ['#abc', '#aabbcc'],
    ['#AABBCC', '#aabbcc'],
    ['rgb(17, 34, 51)', '#112233'],
    ['rgb(10% 20% 30%)', '#1a334d'],
    ['color(srgb 0.1 0.2 0.3)', '#1a334d'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeOpaqueColor(input, '#ffffff')).toBe(expected)
  })

  it('uses a valid fallback for unsupported CSS syntax', () => {
    expect(normalizeOpaqueColor('not-a-color', '#102030')).toBe('#102030')
  })
})
