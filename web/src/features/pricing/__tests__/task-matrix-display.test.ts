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
import { describe, expect, test } from 'vitest'

import { getDynamicPriceEntries } from '../lib/dynamic-price'
import { getTaskMatrixDisplayTiers } from '../lib/task-matrix-display'
import type { BillingUsageSchema } from '../types'

const resolutionSchema: BillingUsageSchema = {
  seconds: { type: 'number', unit: 'second' },
  resolution: { enum: ['480P', '720P', '1080P'] },
}

const doubleEnumSchema: BillingUsageSchema = {
  quality: { enum: ['high', 'low'] },
  seconds: { type: 'number', unit: 'second' },
  mode: { enum: ['std', 'pro'] },
}

const numberOnlySchema: BillingUsageSchema = {
  seconds: { type: 'number', unit: 'second' },
}

describe('task matrix marketplace display rows', () => {
  test('expands a uniform flat expression into every enum combination', () => {
    const rows = getTaskMatrixDisplayTiers(
      'tier("base", u("seconds") * 0.4)',
      resolutionSchema
    )

    expect(rows).toStrictEqual([
      {
        label: '480P',
        conditions: [{ field: 'resolution', value: '480P' }],
        constant: 0,
        unitPrices: { seconds: 0.4 },
      },
      {
        label: '720P',
        conditions: [{ field: 'resolution', value: '720P' }],
        constant: 0,
        unitPrices: { seconds: 0.4 },
      },
      {
        label: '1080P',
        conditions: [{ field: 'resolution', value: '1080P' }],
        constant: 0,
        unitPrices: { seconds: 0.4 },
      },
    ])
  })

  test('expands a full non-uniform partition in canonical order with combination labels', () => {
    const expression =
      'u("mode") == "std" && u("quality") == "high" ? tier("std·high", 0.1 + u("seconds") * 0.2) : u("mode") == "std" && u("quality") == "low" ? tier("std·low", 0.2 + u("seconds") * 0.3) : u("mode") == "pro" && u("quality") == "high" ? tier("pro·high", 0.3 + u("seconds") * 0.4) : tier("pro·low", 0.4 + u("seconds") * 0.5)'

    expect(
      getTaskMatrixDisplayTiers(expression, doubleEnumSchema)
    ).toStrictEqual([
      {
        label: 'std·high',
        conditions: [
          { field: 'mode', value: 'std' },
          { field: 'quality', value: 'high' },
        ],
        constant: 0.1,
        unitPrices: { seconds: 0.2 },
      },
      {
        label: 'std·low',
        conditions: [
          { field: 'mode', value: 'std' },
          { field: 'quality', value: 'low' },
        ],
        constant: 0.2,
        unitPrices: { seconds: 0.3 },
      },
      {
        label: 'pro·high',
        conditions: [
          { field: 'mode', value: 'pro' },
          { field: 'quality', value: 'high' },
        ],
        constant: 0.3,
        unitPrices: { seconds: 0.4 },
      },
      {
        label: 'pro·low',
        conditions: [
          { field: 'mode', value: 'pro' },
          { field: 'quality', value: 'low' },
        ],
        constant: 0.4,
        unitPrices: { seconds: 0.5 },
      },
    ])
  })

  test('returns null for a number-only schema so the single-row display stays', () => {
    expect(
      getTaskMatrixDisplayTiers(
        'tier("base", u("seconds") * 0.4)',
        numberOnlySchema
      )
    ).toBe(null)
  })

  test('returns null for an unrecognizable sparse expression', () => {
    expect(
      getTaskMatrixDisplayTiers(
        'u("seconds") > 30 ? tier("long", u("seconds") * 0.3) : tier("short", u("seconds") * 0.4)',
        resolutionSchema
      )
    ).toBe(null)
  })

  test('returns null when there is no usage schema', () => {
    expect(
      getTaskMatrixDisplayTiers('tier("base", p * 2 + c * 8)', undefined)
    ).toBe(null)
  })

  test('keeps group-ratio multiplication on expanded display-row unit prices', () => {
    const rows = getTaskMatrixDisplayTiers(
      'tier("base", 0.1 + u("seconds") * 0.4)',
      resolutionSchema
    )
    if (!rows) expect.fail('Expected rows to be present')
    expect(rows.length).toBe(3)

    const baseEntries = getDynamicPriceEntries(rows[0], {
      tokenUnit: 'K',
      showRechargePrice: false,
      usageSchema: resolutionSchema,
      groupRatioMultiplier: 1,
    })
    const doubledEntries = getDynamicPriceEntries(rows[0], {
      tokenUnit: 'K',
      showRechargePrice: false,
      usageSchema: resolutionSchema,
      groupRatioMultiplier: 2,
    })

    expect(baseEntries[0]?.value).toBe(0.4)
    expect(doubledEntries[0]?.value).toBe(0.4)
    expect(baseEntries[0]?.formatted ?? '').toMatch(/0[.,]4/)
    expect(doubledEntries[0]?.formatted ?? '').toMatch(/0[.,]8/)
    expect(baseEntries.at(-1)?.value).toBe(0.1)
    expect(doubledEntries.at(-1)?.formatted ?? '').toMatch(/0[.,]2/)
  })
})
