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
import {
  formatDynamicUnitPrice,
  getOfficialDynamicPricingSummary,
} from './dynamic-price'
import {
  formatOfficialPrice,
  formatOfficialRequestPrice,
  formatPrice,
  formatRequestPrice,
} from './price'

const formulaModel: PricingModel = {
  id: 4,
  model_name: 'billing-formula-model',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 1,
  cache_ratio: 0.1,
  enable_groups: ['sale'],
  group_ratio: { sale: 0.05 },
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

const dynamicModel: PricingModel = {
  id: 3,
  model_name: 'discounted-dynamic-model',
  quota_type: 0,
  model_ratio: 0,
  completion_ratio: 0,
  enable_groups: [],
  billing_mode: 'tiered_expr',
  billing_expr: 'tier("standard", p * 5 + c * 30 + cr * 1)',
}

describe('billing exchange rate model-square prices', () => {
  test('applies the billing exchange rate after the token group ratio', () => {
    assert.equal(
      formatPrice(formulaModel, 'input', 'M', false, 1, 7.3, 'sale'),
      '$0.05'
    )
    assert.equal(
      formatPrice(formulaModel, 'input', 'M', true, 1, 7.3, 'sale'),
      '¥0.365'
    )
    assert.equal(formatOfficialPrice(formulaModel, 'input', 'M', 7.3), '¥7.3')
    assert.equal(
      formatOfficialPrice(formulaModel, 'input', 'K', 7.3),
      '¥0.0073'
    )
    assert.equal(formatOfficialPrice(formulaModel, 'cache', 'M', 7.3), '¥0.73')
    assert.equal(
      formatPrice(formulaModel, 'cache', 'M', true, 1, 7.3, 'sale'),
      '¥0.0365'
    )
    assert.equal(
      formatPrice(formulaModel, 'input', 'M', true, 1, Number.NaN, 'sale'),
      '¥0.05'
    )
  })

  test('applies the same formula to per-request prices', () => {
    assert.equal(
      formatRequestPrice(requestModel, false, 1, 7.3, 'sale'),
      '$0.1'
    )
    assert.equal(formatOfficialRequestPrice(requestModel, 7.3), '¥2.92')
    assert.equal(
      formatRequestPrice(requestModel, true, 1, 7.3, 'sale'),
      '¥0.73'
    )
  })

  test('applies the same formula to dynamic prices', () => {
    assert.equal(
      formatDynamicUnitPrice(5, {
        tokenUnit: 'M',
        showRechargePrice: true,
        usdExchangeRate: 7.3,
        groupRatioMultiplier: 0.2,
      }),
      '¥7.3'
    )
    assert.equal(
      formatDynamicUnitPrice(5, {
        tokenUnit: 'M',
        showRechargePrice: false,
        usdExchangeRate: 7.3,
        groupRatioMultiplier: 0.2,
      }),
      '$1'
    )
    const officialSummary = getOfficialDynamicPricingSummary(
      dynamicModel,
      'M',
      7.3
    )
    assert.deepEqual(
      officialSummary?.entries.map((entry) => entry.formatted),
      ['¥36.5', '¥219', '¥7.3']
    )
  })
})
