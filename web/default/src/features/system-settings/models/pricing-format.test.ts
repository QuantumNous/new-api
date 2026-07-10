import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  formatDisplayPriceFromUSD,
  formatUSDPriceFromDisplay,
} from './pricing-format.ts'

describe('model pricing display currency conversion', () => {
  test('converts stored USD model prices to the configured display currency', () => {
    assert.equal(formatDisplayPriceFromUSD('3', 7), '21')
  })

  test('converts display currency model prices back to stored USD values', () => {
    assert.equal(formatUSDPriceFromDisplay('21', 7), '3')
  })
})
