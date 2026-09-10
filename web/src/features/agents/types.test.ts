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
  adminAgentSchema,
  agentCodeSchema,
  agentCreditAdjustmentRequestSchema,
  agentOverviewSchema,
  agentPurchaseRequestSchema,
  apiResponseSchema,
  typedRedemptionSchema,
} from './types'

describe('agent response contracts', () => {
  test('accepts quota zero and masked package-code inventory', () => {
    expect(typedRedemptionSchema.parse({ type: 'quota', quota: 0 })).toEqual({
      type: 'quota',
      quota: 0,
    })

    const code = agentCodeSchema.parse({
      id: 1,
      code: '',
      agent_user_id: 2,
      order_id: 3,
      order_no: 'AG-3',
      plan_id: 4,
      plan_title: 'Plan',
      status: 'unused',
      code_visible: false,
      used_user_id: 0,
      created_at: 10,
      expired_at: 20,
      redeemed_at: 0,
    })
    expect(code.code_visible).toBe(false)
    expect(code.code).toBe('')
  })

  test('accepts omitted admin display identity and failure envelopes', () => {
    const agent = adminAgentSchema.parse({
      id: 1,
      user_id: 2,
      status: 'active',
      balance: '0.00',
      daily_code_limit: 200,
      daily_count_date: '',
      daily_code_count: 0,
      version: 0,
      created_at: 10,
      updated_at: 10,
    })
    expect(agent.username).toBe(undefined)

    expect(
      apiResponseSchema(agentOverviewSchema).parse({
        success: false,
        message: 'agent account not found',
      })
    ).toEqual({ success: false, message: 'agent account not found' })
  })
})

describe('agent request string boundaries', () => {
  test('measures idempotency keys in UTF-8 bytes', () => {
    const base = { plan_id: 1, quantity: 1 }
    expect(
      agentPurchaseRequestSchema.parse({
        ...base,
        idempotency_key: 'a'.repeat(96),
      }).idempotency_key.length
    ).toBe(96)
    expect(
      agentPurchaseRequestSchema.parse({
        ...base,
        idempotency_key: '😀'.repeat(24),
      }).idempotency_key
    ).toBe('😀'.repeat(24))
    expect(() =>
      agentPurchaseRequestSchema.parse({
        ...base,
        idempotency_key: 'a'.repeat(97),
      })
    ).toThrow()
    expect(() =>
      agentPurchaseRequestSchema.parse({
        ...base,
        idempotency_key: '😀'.repeat(25),
      })
    ).toThrow()
  })

  test('measures reasons in Unicode code points after trimming', () => {
    const request = {
      amount: '1.00',
      direction: 'credit' as const,
      idempotency_key: 'credit-1',
    }
    const parsed = agentCreditAdjustmentRequestSchema.parse({
      ...request,
      reason: `  ${'😀'.repeat(255)}  `,
    })
    expect([...parsed.reason].length).toBe(255)
    expect(() =>
      agentCreditAdjustmentRequestSchema.parse({
        ...request,
        reason: '😀'.repeat(256),
      })
    ).toThrow()
  })
})
