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

import {
  computeTestCostQuota,
  parseStreamUsage,
  parseUsageTokens,
} from '../message-usage-utils'

describe('parseUsageTokens', () => {
  test('reads prompt and completion tokens from a usage object', () => {
    expect(
      parseUsageTokens({
        prompt_tokens: 13,
        completion_tokens: 242,
        total_tokens: 255,
      })
    ).toEqual({ promptTokens: 13, completionTokens: 242 })
  })

  test('returns null without usage or with non-numeric counts', () => {
    expect(parseUsageTokens(undefined)).toBeNull()
    expect(parseUsageTokens(null)).toBeNull()
    expect(parseUsageTokens({ prompt_tokens: 'x' })).toBeNull()
  })
})

describe('parseStreamUsage', () => {
  test('reads the usage of the final stream chunk', () => {
    const data = JSON.stringify({
      choices: [],
      usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 },
    })
    expect(parseStreamUsage(data)).toEqual({
      promptTokens: 9,
      completionTokens: 4,
    })
  })

  test('returns null for content chunks and unparsable data', () => {
    expect(
      parseStreamUsage(
        JSON.stringify({ choices: [{ delta: { content: 'a' } }] })
      )
    ).toBeNull()
    expect(parseStreamUsage('not json')).toBeNull()
  })
})

describe('computeTestCostQuota', () => {
  test('is the balance drop of the test', () => {
    expect(computeTestCostQuota(500_000, 499_967)).toBe(33)
  })

  test('is 0 when the balance did not drop or is unknown', () => {
    expect(computeTestCostQuota(500_000, 500_000)).toBe(0)
    expect(computeTestCostQuota(500_000, 600_000)).toBe(0)
    expect(computeTestCostQuota(undefined, 499_967)).toBe(0)
    expect(computeTestCostQuota(500_000, Number.NaN)).toBe(0)
  })
})
