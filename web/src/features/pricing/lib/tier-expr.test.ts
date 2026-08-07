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

import { evalExprLocally, type ExtraTokenValues } from './tier-expr'

const NO_EXTRAS: ExtraTokenValues = {
  cacheReadTokens: 0,
  cacheCreateTokens: 0,
  cacheCreate1hTokens: 0,
  imageTokens: 0,
  imageOutputTokens: 0,
  audioInputTokens: 0,
  audioOutputTokens: 0,
}

describe('evalExprLocally request and time functions', () => {
  test('header() resolves like an absent request header', () => {
    const result = evalExprLocally(
      'header("x-billing-tier") == "pro" ? tier("pro", p * 2) : tier("std", p * 1)',
      100,
      0,
      NO_EXTRAS
    )
    assert.equal(result.error, null)
    assert.equal(result.cost, 100)
    assert.equal(result.matchedTier, 'std')
  })

  test('param() resolves like an absent body field', () => {
    const result = evalExprLocally(
      'has(param("model"), "mini") ? tier("mini", p * 0.5) : tier("full", p * 1)',
      100,
      0,
      NO_EXTRAS
    )
    assert.equal(result.error, null)
    assert.equal(result.cost, 100)
    assert.equal(result.matchedTier, 'full')
  })

  test('has() matches substrings on literal sources', () => {
    const result = evalExprLocally(
      'has("gpt-4o-mini", "mini") ? tier("mini", p * 0.5) : tier("full", p * 1)',
      100,
      0,
      NO_EXTRAS
    )
    assert.equal(result.error, null)
    assert.equal(result.cost, 50)
    assert.equal(result.matchedTier, 'mini')
  })

  test('time functions evaluate without error', () => {
    const result = evalExprLocally(
      'hour("Asia/Shanghai") >= 0 && hour("Asia/Shanghai") <= 23 && ' +
        'minute("Asia/Shanghai") >= 0 && minute("Asia/Shanghai") <= 59 && ' +
        'weekday("Asia/Shanghai") >= 0 && weekday("Asia/Shanghai") <= 6 && ' +
        'month("Asia/Shanghai") >= 1 && month("Asia/Shanghai") <= 12 && ' +
        'day("Asia/Shanghai") >= 1 && day("Asia/Shanghai") <= 31 ? 1 : 0',
      0,
      0,
      NO_EXTRAS
    )
    assert.equal(result.error, null)
    assert.equal(result.cost, 1)
  })

  test('time functions fall back to UTC for an invalid timezone', () => {
    const result = evalExprLocally(
      'hour("Not/AZone") >= 0 && hour("Not/AZone") <= 23 ? 1 : 0',
      0,
      0,
      NO_EXTRAS
    )
    assert.equal(result.error, null)
    assert.equal(result.cost, 1)
  })
})
