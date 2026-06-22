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
  getAmountBonusGroupsJsonError,
  getAmountBonusJsonError,
  getAmountBonusLimitJsonError,
  parseAmountBonusGroupsJson,
  parseAmountBonusJson,
  parseAmountBonusLimitJson,
  removeAmountBonusGroups,
  setAmountBonusGroups,
  setAmountBonusLimit,
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

  test('validates claim-limit JSON allowing zero/non-negative counts', () => {
    expect(getAmountBonusLimitJsonError('{"20":2,"50":1}')).toBeNull()
    expect(getAmountBonusLimitJsonError('{"20":0}')).toBeNull()
    expect(getAmountBonusLimitJsonError('{"20":-1}')).not.toBeNull()
    expect(getAmountBonusLimitJsonError('{"20":"2"}')).not.toBeNull()
    expect(getAmountBonusLimitJsonError('{"20.5":2}')).not.toBeNull()
  })

  test('parses claim-limit JSON into a numeric record', () => {
    expect(parseAmountBonusLimitJson('{"20":2,"bad":3,"50":1}')).toEqual({
      20: 2,
      50: 1,
    })
  })

  test('setAmountBonusLimit upserts positive limits and removes zero', () => {
    expect(setAmountBonusLimit('{"20":2}', 50, 1)).toBe(
      '{\n  "20": 2,\n  "50": 1\n}'
    )
    // 0 表示不限 → 从配置移除
    expect(setAmountBonusLimit('{"20":2,"50":1}', 20, 0)).toBe(
      '{\n  "50": 1\n}'
    )
  })

  test('validates bonus-group JSON as amount-to-string-array map', () => {
    expect(getAmountBonusGroupsJsonError('{"20":["plg"],"50":["all"]}')).toBeNull()
    expect(getAmountBonusGroupsJsonError('{"20":[]}')).toBeNull() // 空数组合法（显式不送）
    expect(getAmountBonusGroupsJsonError('')).toBeNull()
    expect(getAmountBonusGroupsJsonError('{"20":"plg"}')).not.toBeNull() // 值必须是数组
    expect(getAmountBonusGroupsJsonError('{"20":[""]}')).not.toBeNull() // 组名不能为空
    expect(getAmountBonusGroupsJsonError('{"20.5":["plg"]}')).not.toBeNull()
    expect(getAmountBonusGroupsJsonError('{"20":[1]}')).not.toBeNull()
  })

  test('parses bonus-group JSON into a numeric record, trimming names', () => {
    expect(
      parseAmountBonusGroupsJson('{"20":["plg"," vip "],"bad":["x"],"50":[]}')
    ).toEqual({
      20: ['plg', 'vip'],
      50: [],
    })
  })

  test('setAmountBonusGroups upserts a tier whitelist, keeping empty arrays', () => {
    expect(setAmountBonusGroups('{"20":["plg"]}', 50, ['all'])).toBe(
      '{\n  "20": [\n    "plg"\n  ],\n  "50": [\n    "all"\n  ]\n}'
    )
    // 空数组语义为「显式配置为不送」，保留而非删除
    expect(setAmountBonusGroups('{"20":["plg"]}', 20, [])).toBe(
      '{\n  "20": []\n}'
    )
  })

  test('removeAmountBonusGroups drops a tier whitelist entirely', () => {
    expect(removeAmountBonusGroups('{"20":["plg"],"50":["all"]}', 20)).toBe(
      '{\n  "50": [\n    "all"\n  ]\n}'
    )
  })
})
