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
import { describe, it } from 'node:test'

import {
  formatSavingsQuotaAsCNY,
  getRollingSavingsTimeRange,
} from '../savings.ts'

describe('getRollingSavingsTimeRange', () => {
  it('returns a rolling 24 hour window aligned to minute boundaries', () => {
    const first = getRollingSavingsTimeRange(1_700_000_001_000)
    const sameMinute = getRollingSavingsTimeRange(1_700_000_019_000)
    const nextMinute = getRollingSavingsTimeRange(1_700_000_061_000)

    assert.equal(first.end_timestamp - first.start_timestamp, 24 * 60 * 60)
    assert.deepEqual(sameMinute, first)
    assert.equal(nextMinute.end_timestamp - first.end_timestamp, 60)
  })
})

describe('formatSavingsQuotaAsCNY', () => {
  it('converts quota through USD into CNY with the configured exchange rate', () => {
    const formatted = formatSavingsQuotaAsCNY(10_537_576, 500_000, 7.3, 'zh-CN')

    assert.equal(formatted, '¥153.85')
  })
})
