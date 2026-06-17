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
import { describe, expect, test } from 'bun:test'
import { calculatePresetPricing } from './format'
import { generatePresetAmounts, mergePresetAmounts } from './payment'

describe('top-up bonus preset metadata', () => {
  test('attaches configured bonus amounts to custom presets', () => {
    expect(mergePresetAmounts([20, 50], {}, { 20: 5 })).toEqual([
      { value: 20, discount: 1, bonus: 5 },
      { value: 50, discount: 1 },
    ])
  })

  test('attaches configured bonus amounts to generated presets', () => {
    expect(generatePresetAmounts(20, { 20: 5 })[0]).toEqual({
      value: 20,
      bonus: 5,
    })
  })

  test('calculates credited total separately from the payment amount', () => {
    expect(calculatePresetPricing(20, 1, 1, 1, 5)).toMatchObject({
      bonusAmount: 5,
      creditAmount: 25,
      actualPrice: 20,
    })
  })
})
