/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { PricingModel } from '../types'
import { formatDynamicUnitPrice } from './dynamic-price'
import {
  formatOfficialPrice,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
} from './price'

const tokenModel: PricingModel = {
  id: 1,
  model_name: 'discounted-token-model',
  quota_type: 0,
  model_ratio: 2.5,
  completion_ratio: 6,
  enable_groups: ['sale'],
  group_ratio: { sale: 0.2 },
}

const requestModel: PricingModel = {
  id: 2,
  model_name: 'discounted-request-model',
  quota_type: 1,
  model_ratio: 0,
  completion_ratio: 0,
  model_price: 0.4,
  enable_groups: ['sale'],
  group_ratio: { sale: 0.25 },
}

describe('official model-square prices', () => {
  test('keeps token base prices independent from the selected group discount', () => {
    assert.equal(
      formatPrice(tokenModel, 'input', 'M', false, 1, 1, 'sale'),
      '$1'
    )
    assert.equal(formatOfficialPrice(tokenModel, 'input', 'M'), '$5')
    assert.equal(
      formatPrice(tokenModel, 'output', 'M', false, 1, 1, 'sale'),
      '$6'
    )
    assert.equal(formatOfficialPrice(tokenModel, 'output', 'M'), '$30')
  })

  test('keeps official token prices in USD while the current price changes currency', () => {
    assert.equal(formatOfficialPrice(tokenModel, 'input', 'K'), '$0.005')
    assert.equal(formatOfficialPrice(tokenModel, 'output', 'M'), '$30')
    assert.equal(
      formatPrice(tokenModel, 'input', 'M', true, 1, 1, 'sale'),
      '¥1'
    )
  })

  test('keeps per-request base prices independent from the selected group discount', () => {
    assert.equal(formatRequestPrice(requestModel, false, 1, 1, 'sale'), '$0.1')
    assert.equal(formatOfficialRequestPrice(requestModel), '$0.4')
    assert.equal(formatRequestPrice(requestModel, true, 1, 1, 'sale'), '¥0.1')
  })

  test('keeps dynamic official prices in USD while the current price uses CNY', () => {
    assert.equal(
      formatDynamicUnitPrice(5, {
        tokenUnit: 'M',
        showRechargePrice: true,
        groupRatioMultiplier: 0.2,
      }),
      '¥1'
    )
    assert.equal(
      formatDynamicUnitPrice(5, {
        tokenUnit: 'M',
        showRechargePrice: false,
        groupRatioMultiplier: 1,
      }),
      '$5'
    )
  })
})
