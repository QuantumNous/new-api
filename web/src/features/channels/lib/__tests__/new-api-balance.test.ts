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

import type { Channel, ChannelBalanceInfo } from '../../types'
import { channelNeedsAttention } from '../channel-utils'
import { formatNewAPIBalance } from '../new-api-balance'

const balance = (
  overrides: Partial<ChannelBalanceInfo> = {}
): ChannelBalanceInfo => ({
  remaining: '123.45',
  unit: 'money',
  currency: 'USD',
  unlimited: false,
  updated_at: 1_786_000_000,
  ...overrides,
})

describe('New API balance', () => {
  test('formats money, credits and unlimited quota', () => {
    assert.equal(formatNewAPIBalance(balance()), '$123.45')
    assert.equal(
      formatNewAPIBalance(
        balance({
          unit: 'credits',
          currency: undefined,
          display_unit: 'credits',
        })
      ),
      '123.45 credits'
    )
    assert.equal(
      formatNewAPIBalance(balance({ unlimited: true }), '无限制'),
      '无限制'
    )
  })

  test('does not apply the legacy USD warning to native balances', () => {
    const channel = {
      id: 9,
      type: 60,
      status: 1,
      balance: 0.5,
      balance_info: balance({ currency: 'CNY', remaining: '0.5' }),
    } as Channel
    assert.equal(channelNeedsAttention(channel), false)
    assert.equal(
      channelNeedsAttention({ ...channel, balance_info: null }),
      true
    )
  })
})
