import { describe, expect, test } from 'bun:test'

import { evalExprLocally } from '../src/features/pricing/lib/tier-expr'

const EMPTY_EXTRAS = {
  cacheReadTokens: 0,
  cacheCreateTokens: 0,
  cacheCreate1hTokens: 0,
  imageTokens: 0,
  imageOutputTokens: 0,
  audioInputTokens: 0,
  audioOutputTokens: 0,
}

describe('safe local billing expression evaluation', () => {
  test('evaluates tiered arithmetic and records the selected tier', () => {
    const result = evalExprLocally(
      'p <= 200000 ? tier("standard", p * 1.5 + c * 7.5) : tier("long", p * 3 + c * 11.25)',
      100_000,
      5_000,
      EMPTY_EXTRAS
    )

    expect(result).toEqual({
      cost: 187_500,
      matchedTier: 'standard',
      error: null,
    })
  })

  test('supports the documented numeric helpers', () => {
    const result = evalExprLocally(
      'ceil(max(p, c) / 1000) + floor(abs(-1.9))',
      1_500,
      500,
      EMPTY_EXTRAS
    )

    expect(result).toEqual({ cost: 3, matchedTier: '', error: null })
  })

  test('rejects JavaScript instead of executing it', () => {
    const marker = '__chimeraBillingEvalExecuted'
    delete (globalThis as Record<string, unknown>)[marker]

    const result = evalExprLocally(
      `globalThis.${marker} = true, 0`,
      0,
      0,
      EMPTY_EXTRAS
    )

    expect(result.error).toBeTruthy()
    expect((globalThis as Record<string, unknown>)[marker]).toBeUndefined()
  })
})
