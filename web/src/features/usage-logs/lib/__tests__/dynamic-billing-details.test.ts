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
import { getTieredBillingSummary } from '../format'
import { getDynamicBillingDetails } from '../request-details'

const expression = 'tier("base", p * 2 + c * 10 + cr * 0.2 + cc * 4 + cc1h * 0)'

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function makeOther(overrides: Partial<LogOtherData> = {}): LogOtherData {
  return {
    billing_mode: 'tiered_expr',
    expr_b64: encode(expression),
    matched_tier: 'base',
    billing_usage: {
      p: 5,
      c: 16,
      len: 232,
      cr: 200,
      cc: 7,
      cc1h: 11,
      img: 0,
      img_o: 0,
      ai: 0,
      ao: 0,
    },
    billing_cost_before_group: 0.000238,
    ...overrides,
  }
}

describe('dynamic request billing details', () => {
  it('preserves every declared matched-tier price including an unused free cache rate', () => {
    const summary = getTieredBillingSummary(makeOther(), {
      includeUnusedCache: true,
    })

    expect(
      summary?.priceEntries.map(({ key, price }) => ({ key, price }))
    ).toEqual([
      { key: 'p', price: 2 },
      { key: 'c', price: 10 },
      { key: 'cr', price: 0.2 },
      { key: 'cc', price: 4 },
      { key: 'cc1h', price: 0 },
    ])
  })

  it('builds line items from settled usage and reconciles them to the recorded cost', () => {
    const details = getDynamicBillingDetails(makeOther())

    expect(details).toEqual({
      tierLabel: 'base',
      priceEntries: expect.any(Array),
      requestMultiplier: 1,
      costBeforeGroup: 0.000238,
      lineItems: [
        {
          key: 'p',
          labelKey: 'Input',
          quantity: 5,
          unitPrice: 2,
          costBeforeGroup: 0.00001,
        },
        {
          key: 'c',
          labelKey: 'Output',
          quantity: 16,
          unitPrice: 10,
          costBeforeGroup: 0.00016,
        },
        {
          key: 'cr',
          labelKey: 'Cache Read',
          quantity: 200,
          unitPrice: 0.2,
          costBeforeGroup: 0.00004,
        },
        {
          key: 'cc',
          labelKey: 'Cache Write',
          quantity: 7,
          unitPrice: 4,
          costBeforeGroup: 0.000028,
        },
        {
          key: 'cc1h',
          labelKey: 'Cache Write (1h)',
          quantity: 11,
          unitPrice: 0,
          costBeforeGroup: 0,
        },
      ],
    })
  })

  it('applies only matched request-rule multipliers to every line item', () => {
    const details = getDynamicBillingDetails(
      makeOther({
        request_rules: [
          {
            cond: 'header("x-plan") == "priority"',
            multiplier: 2,
            matched: true,
          },
          { cond: 'param("slow") == true', multiplier: 3, matched: false },
        ],
        billing_cost_before_group: 0.000476,
      })
    )

    expect(details?.requestMultiplier).toBe(2)
    expect(details?.lineItems[0].costBeforeGroup).toBe(0.00002)
    expect(details?.lineItems[1].costBeforeGroup).toBe(0.00032)
    expect(details?.costBeforeGroup).toBe(0.000476)
  })

  it('labels Claude cache creation as separate 5-minute and 1-hour prices', () => {
    const other = makeOther({ claude: true })

    expect(
      getTieredBillingSummary(other, {
        includeUnusedCache: true,
      })
        ?.priceEntries.filter(
          (entry) => entry.key === 'cc' || entry.key === 'cc1h'
        )
        .map((entry) => entry.shortLabel)
    ).toEqual(['Cache Write (5m)', 'Cache Write (1h)'])
    expect(
      getDynamicBillingDetails(other)
        ?.lineItems.filter((item) => item.key === 'cc' || item.key === 'cc1h')
        .map((item) => item.labelKey)
    ).toEqual(['Cache Write (5m)', 'Cache Write (1h)'])
  })

  it('rejects missing settlement traces and totals that do not reconcile', () => {
    expect(
      getDynamicBillingDetails(
        makeOther({ billing_cost_before_group: 0.000239 })
      )
    ).toBeNull()
    expect(
      getDynamicBillingDetails(makeOther({ billing_usage: undefined }))
    ).toBeNull()
    expect(
      getDynamicBillingDetails(
        makeOther({ billing_cost_before_group: undefined })
      )
    ).toBeNull()
  })

  it('does not itemize unsupported outer arithmetic as a trustworthy bill', () => {
    expect(
      getDynamicBillingDetails(
        makeOther({
          expr_b64: encode(`${expression} * 2`),
          billing_cost_before_group: 0.000476,
        })
      )
    ).toBeNull()
  })
})
