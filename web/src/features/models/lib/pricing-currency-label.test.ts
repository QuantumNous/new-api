import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  getPricingCurrencyLabel,
  getPricingModeLabelKey,
} from './pricing-currency-label'

describe('model pricing currency labels', () => {
  test('uses base USD copy only for USD display mode', () => {
    assert.equal(getPricingCurrencyLabel('USD'), 'base USD')
    assert.equal(
      getPricingModeLabelKey('USD'),
      'Price mode (base USD per 1M tokens)'
    )
  })

  test('uses yuan wording for CNY display mode', () => {
    assert.equal(getPricingCurrencyLabel('CNY'), '元')
    assert.equal(
      getPricingModeLabelKey('CNY'),
      'Price mode (based on {{currency}} per 1M tokens)'
    )
  })

  test('uses custom currency symbol for custom display mode', () => {
    assert.equal(getPricingCurrencyLabel('CUSTOM', 'HK$'), 'HK$')
    assert.equal(
      getPricingModeLabelKey('CUSTOM'),
      'Price mode (based on {{currency}} per 1M tokens)'
    )
  })
})
