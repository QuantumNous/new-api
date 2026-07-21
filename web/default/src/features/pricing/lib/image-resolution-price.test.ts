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

import { SORT_OPTIONS } from '../constants'
import type { PricingModel } from '../types'
import { sortModels } from './filters'
import {
  getImageResolutionPriceEntries,
  getImageResolutionStartingPrice,
} from './image-resolution-price'
import { formatImageResolutionPrice } from './price'

const model: PricingModel = {
  id: 1,
  model_name: 'image-model',
  quota_type: 1,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: [],
  image_resolution_prices: {
    '4K': 0.4,
    '512': 0.05,
    '1K': 0.1,
    '2048': 0.2,
  },
}

describe('image resolution price display', () => {
  test('sorts pixel and K tiers by their numeric size', () => {
    assert.deepEqual(
      getImageResolutionPriceEntries(model).map(([resolution]) => resolution),
      ['512', '1K', '2048', '4K']
    )
  })

  test('suppresses fixed resolution prices for dynamic billing models', () => {
    assert.deepEqual(
      getImageResolutionPriceEntries({
        ...model,
        billing_mode: 'tiered_expr',
        billing_expr: 'tier("base", p * 0.1)',
      }),
      []
    )
  })

  test('formats base and recharge-adjusted USD prices consistently', () => {
    assert.equal(formatImageResolutionPrice(0.25), '$0.25')
    assert.equal(formatImageResolutionPrice(0.25, true, 0.5, 1), '$0.125')
  })

  test('uses the lowest configured tier as the request starting price', () => {
    assert.equal(getImageResolutionStartingPrice(model), 0.05)
    assert.equal(
      getImageResolutionStartingPrice({
        ...model,
        quota_type: 0,
        model_price: undefined,
      }),
      0.05
    )
  })

  test('sorts by the same group-adjusted starting price shown in summaries', () => {
    const lowerBasePrice: PricingModel = {
      ...model,
      model_name: 'lower-base-price',
      enable_groups: ['premium'],
      group_ratio: { premium: 2 },
      image_resolution_prices: { '1K': 0.1 },
    }
    const lowerDisplayedPrice: PricingModel = {
      ...model,
      model_name: 'lower-displayed-price',
      enable_groups: ['premium'],
      group_ratio: { premium: 1 },
      image_resolution_prices: { '1K': 0.15 },
    }

    assert.deepEqual(
      sortModels(
        [lowerBasePrice, lowerDisplayedPrice],
        SORT_OPTIONS.PRICE_LOW,
        'premium'
      ).map((item) => item.model_name),
      ['lower-displayed-price', 'lower-base-price']
    )
  })
})
