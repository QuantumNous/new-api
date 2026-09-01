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

import type { UsageLog } from '@/features/usage-logs/data/schema'

import { estimateEasySavings } from '../easy-savings'

function createUsageLog(overrides: Partial<UsageLog> = {}): UsageLog {
  return {
    id: 1,
    user_id: 1,
    created_at: 1,
    type: 2,
    content: '',
    username: '',
    token_name: '',
    model_name: 'deepseek-v4',
    quota: 500_000,
    prompt_tokens: 1000,
    completion_tokens: 500,
    use_time: 1,
    is_stream: false,
    channel: 1,
    channel_name: '',
    token_id: 1,
    group: 'default',
    ip: '',
    other: JSON.stringify({ group_ratio: 0.5 }),
    request_id: '',
    upstream_request_id: '',
    ...overrides,
  }
}

describe('easy savings estimate', () => {
  it('compares logged site billing with the official equivalent in CNY', () => {
    const result = estimateEasySavings([createUsageLog()], {
      priceRate: 4,
      usdExchangeRate: 7,
      quotaPerUnit: 500_000,
    })

    expect(result).toEqual({
      officialCost: 14,
      siteCost: 4,
      savings: 10,
      comparableRequests: 1,
    })
  })

  it('skips logs that do not contain their historical group ratio', () => {
    const result = estimateEasySavings(
      [createUsageLog({ other: '{}' }), createUsageLog({ type: 4 })],
      {
        priceRate: 4,
        usdExchangeRate: 7,
        quotaPerUnit: 500_000,
      }
    )

    expect(result.comparableRequests).toBe(0)
    expect(result.savings).toBe(0)
  })

  it('uses the final fee quota when a request log contains an adjusted fee', () => {
    const result = estimateEasySavings(
      [
        createUsageLog({
          quota: 500_000,
          other: JSON.stringify({ group_ratio: 0.5, fee_quota: 250_000 }),
        }),
      ],
      {
        priceRate: 4,
        usdExchangeRate: 7,
        quotaPerUnit: 500_000,
      }
    )

    expect(result.siteCost).toBe(2)
    expect(result.officialCost).toBe(7)
    expect(result.savings).toBe(5)
  })
})
