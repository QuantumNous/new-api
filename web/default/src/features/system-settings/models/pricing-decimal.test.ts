import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  dividePricingDecimals,
  formatPricingDecimal,
  multiplyPricingDecimals,
} from './pricing-decimal'

describe('formatPricingDecimal', () => {
  const cases = [
    { input: 8, expected: '8' },
    { input: 0.99, expected: '0.99' },
    { input: 4.9, expected: '4.9' },
    { input: 15, expected: '15' },
    { input: 0, expected: '0' },
    { input: 0.000001, expected: '0.000001' },
    { input: 1.234567, expected: '1.234567' },
    { input: 20, expected: '20' },
    { input: 7.999999999999999, expected: '8' },
    { input: 0.9899999999999999, expected: '0.99' },
    { input: 4.899999999999999, expected: '4.9' },
    { input: 14.999999999999998, expected: '15' },
  ] as const

  for (const { input, expected } of cases) {
    test(`formats ${String(input)} as ${expected}`, () => {
      assert.equal(formatPricingDecimal(input), expected)
    })
  }
})

describe('pricing decimal round-trip helpers', () => {
  test('reconstructs lane prices from corrupted float ratios', () => {
    const ratio = 3.9999999999999996
    const promptPrice = multiplyPricingDecimals(ratio, 2)
    assert.equal(promptPrice, '8')
    assert.equal(
      multiplyPricingDecimals(0.9999999999999999, promptPrice),
      '8',
    )
    assert.equal(
      multiplyPricingDecimals(0.12374999999999999, promptPrice),
      '0.99',
    )
    assert.equal(
      multiplyPricingDecimals(0.6124999999999999, promptPrice),
      '4.9',
    )
    const audioInput = multiplyPricingDecimals(0.9999999999999999, promptPrice)
    assert.equal(
      multiplyPricingDecimals(1.8749999999999998, audioInput),
      '15',
    )
  })

  test('dividePricingDecimals preserves user-entered ratios', () => {
    assert.equal(dividePricingDecimals(8, 4), '2')
    assert.equal(dividePricingDecimals(0.99, 4), '0.2475')
    assert.equal(dividePricingDecimals(15, 8), '1.875')
  })
})
