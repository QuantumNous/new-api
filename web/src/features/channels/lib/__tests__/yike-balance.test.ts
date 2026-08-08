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

import {
  formatYikeCredits,
  isYikeChannel,
  YIKE_CHANNEL_TYPE,
} from '../yike-balance'

describe('Yike credit balance', () => {
  test('formats native credits without a currency symbol', () => {
    assert.equal(formatYikeCredits(104, '积分', 'zh-CN'), '104 积分')
  })

  test('recognizes only the Yike channel type', () => {
    assert.equal(isYikeChannel(YIKE_CHANNEL_TYPE), true)
    assert.equal(isYikeChannel(1), false)
  })
})
