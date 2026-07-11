import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../types'
import { formatPrice, formatRequestPrice } from './price'

const tokenModel: PricingModel = {
  id: 1,
  model_name: 'gpt-test',
  quota_type: 0,
  model_ratio: 1,
  completion_ratio: 3,
  enable_groups: ['default', 'vip'],
  group_ratio: {
    default: 1,
    vip: 2,
  },
}

const requestModel: PricingModel = {
  ...tokenModel,
  quota_type: 1,
  model_price: 10,
}

describe('pricing display prices', () => {
  test('uses the selected group ratio for token prices', () => {
    assert.equal(
      formatPrice(tokenModel, 'input', 'M', false, 1, 1, 'vip'),
      '$4'
    )
    assert.equal(
      formatPrice(tokenModel, 'output', 'M', false, 1, 1, 'vip'),
      '$12'
    )
  })

  test('uses the selected group ratio for request prices', () => {
    assert.equal(
      formatRequestPrice(requestModel, false, 1, 1, 'vip'),
      '$20'
    )
  })

  test('falls back to the lowest enabled group price when no group is selected', () => {
    assert.equal(
      formatPrice(tokenModel, 'input', 'M', false, 1, 1),
      '$2'
    )
    assert.equal(
      formatRequestPrice(requestModel, false, 1, 1),
      '$10'
    )
  })
})
