import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  RATIO_USD_PER_MILLION_TOKENS,
  ratioToUsdPerMillion,
  usdPerMillionToRatio,
} from './ratio'

describe('ratio <-> $/1M token conversion', () => {
  test('coefficient equals 2 (= 1e6 / QuotaPerUnit(500000))', () => {
    assert.equal(RATIO_USD_PER_MILLION_TOKENS, 2)
    assert.equal(ratioToUsdPerMillion(1), 2)
  })

  test('round-trip ratio -> $/1M -> ratio is identity', () => {
    // model-mutate-drawer reads a ratio as $/1M for display and writes the
    // edited value back to a ratio; this must not drift.
    for (const ratio of [0, 0.5, 1, 2.5, 15, 37.5, 300]) {
      assert.equal(usdPerMillionToRatio(ratioToUsdPerMillion(ratio)), ratio)
    }
  })

  test('round-trip $/1M -> ratio -> $/1M is identity', () => {
    for (const usd of [0, 1, 5, 30, 75]) {
      assert.equal(ratioToUsdPerMillion(usdPerMillionToRatio(usd)), usd)
    }
  })
})
