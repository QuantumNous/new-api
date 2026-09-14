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
import { describe, expect, it } from 'vitest'

import type { LogOtherData } from '../../types'
import {
  getLogCostComparison,
  getLogQuotaComparison,
  OFFICIAL_PRICE_USD_TO_CNY as COST_COMPARISON_USD_TO_CNY,
} from '../cost-comparison'
import { OFFICIAL_PRICE_USD_TO_CNY } from '../model-provider'

describe('recorded request price comparison', () => {
  it('re-exports the shared official-price conversion constant', () => {
    expect(COST_COMPARISON_USD_TO_CNY).toBe(OFFICIAL_PRICE_USD_TO_CNY)
  })

  it.each([
    [
      'discounted group',
      100,
      { group_ratio: 0.5 },
      { baseQuota: 200, chargedQuota: 100, savedQuota: 100 },
    ],
    [
      'personal override',
      900,
      { group_ratio: 0.5, user_group_ratio: 0.4, fee_quota: 200 },
      { baseQuota: 500, chargedQuota: 200, savedQuota: 300 },
    ],
    [
      'legacy unset override',
      100,
      { group_ratio: 0.5, user_group_ratio: 0 },
      { baseQuota: 200, chargedQuota: 100, savedQuota: 100 },
    ],
    [
      'full price',
      100,
      { group_ratio: 1 },
      { baseQuota: 100, chargedQuota: 100, savedQuota: 0 },
    ],
    [
      'above base price',
      100,
      { group_ratio: 2 },
      { baseQuota: 50, chargedQuota: 100, savedQuota: -50 },
    ],
    [
      'zero charge',
      0,
      { group_ratio: 0.5 },
      { baseQuota: 0, chargedQuota: 0, savedQuota: 0 },
    ],
    [
      'explicit zero fee',
      100,
      { group_ratio: 0.5, fee_quota: 0 },
      { baseQuota: 0, chargedQuota: 0, savedQuota: 0 },
    ],
    [
      'nullable fee',
      100,
      { group_ratio: 0.5, fee_quota: null },
      { baseQuota: 200, chargedQuota: 100, savedQuota: 100 },
    ],
  ])('%s uses the historical multiplier', (_name, quota, other, expected) => {
    expect(
      getLogQuotaComparison(quota as number, other as LogOtherData)
    ).toEqual(expected)
  })

  it.each([
    ['missing rate', 100, {}],
    ['zero rate', 100, { group_ratio: 0 }],
    ['negative rate', 100, { group_ratio: -1 }],
    ['nonfinite rate', 100, { group_ratio: Infinity }],
    ['nonfinite charge', Infinity, { group_ratio: 0.5 }],
    ['negative charge', -100, { group_ratio: 0.5 }],
    ['overflow', Number.MAX_VALUE, { group_ratio: Number.MIN_VALUE }],
    ['penalty charge', 100, { group_ratio: 0.5, violation_fee: true }],
    ['subscription', 100, { group_ratio: 0.5, billing_source: 'subscription' }],
    ['per-request billing', 100, { group_ratio: 0.5, model_price: 0.05 }],
  ])('%s has no monetary comparison', (_name, quota, other) => {
    expect(
      getLogQuotaComparison(quota as number, other as LogOtherData)
    ).toBeNull()
  })

  it('preserves the existing positive-savings currency display contract', () => {
    const rates = { quotaPerUnit: 500000, priceRate: 1 }
    expect(
      getLogCostComparison(
        900000,
        { group_ratio: 0.5, user_group_ratio: 0.4, fee_quota: 200000 },
        rates
      )
    ).toEqual({ baseCost: 1, siteCost: 0.4, savings: 0.6 })
    expect(getLogCostComparison(100, { group_ratio: 1 }, rates)).toBeNull()
    expect(getLogCostComparison(100, { group_ratio: 2 }, rates)).toBeNull()
  })

  it('uses 6.75 to convert the USD price without changing the recharge cost', () => {
    expect(
      getLogCostComparison(
        250000,
        { group_ratio: 0.5 },
        {
          quotaPerUnit: 500000,
          priceRate: 3,
          referenceCurrency: 'USD',
        }
      )
    ).toEqual({ baseCost: 6.75, siteCost: 1.5, savings: 5.25 })
  })

  it('compares a native CNY reference against the actual recharge cost', () => {
    expect(
      getLogCostComparison(
        250000,
        { group_ratio: 0.25 },
        {
          quotaPerUnit: 500000,
          priceRate: 3,
          referenceCurrency: 'CNY',
        }
      )
    ).toEqual({ baseCost: 2, siteCost: 1.5, savings: 0.5 })
    expect(
      getLogCostComparison(
        250000,
        { group_ratio: 0.25 },
        {
          quotaPerUnit: 500000,
          priceRate: 5,
          referenceCurrency: 'CNY',
        }
      )
    ).toBeNull()
  })
})
