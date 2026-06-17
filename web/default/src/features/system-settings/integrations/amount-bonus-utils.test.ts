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
import {
  getAmountBonusJsonError,
  parseAmountBonusJson,
  upsertAmountBonusTier,
} from './amount-bonus-utils'

describe('amount bonus settings helpers', () => {
  test('parses numeric JSON object entries into sorted bonus tiers', () => {
    expect(parseAmountBonusJson('{"50":15,"20":"5","bad":9,"100":0}')).toEqual([
      { amount: 20, bonusAmount: 5 },
      { amount: 50, bonusAmount: 15 },
    ])
  })

  test('validates JSON against backend integer map semantics', () => {
    expect(getAmountBonusJsonError('{"20":5,"50":15}')).toBeNull()
    expect(getAmountBonusJsonError('{"20":"5"}')).not.toBeNull()
    expect(getAmountBonusJsonError('{"20.5":5}')).not.toBeNull()
    expect(getAmountBonusJsonError('[["20",5]]')).not.toBeNull()
  })

  test('serializes edited bonus tiers as amount-to-bonus JSON', () => {
    expect(
      upsertAmountBonusTier('{"20":5}', null, { amount: 50, bonusAmount: 15 })
    ).toBe('{\n  "20": 5,\n  "50": 15\n}')
    expect(
      upsertAmountBonusTier(
        '{"20":5,"50":15}',
        { amount: 20, bonusAmount: 5 },
        {
          amount: 30,
          bonusAmount: 6,
        }
      )
    ).toBe('{\n  "30": 6,\n  "50": 15\n}')
  })
})
