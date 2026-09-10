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

import { agentAccessQueryKey } from '@/features/agents/hooks/use-agent-access'
import {
  agentQueryKeys,
  agentUserQueryKey,
} from '@/features/agents/lib/workspace'
import type { AgentCode } from '@/features/agents/types'

import {
  agentAdminQueryKeys,
  agentAdminSearchSchema,
  createCreditAttempt,
  getAgentAdminAccess,
  getAgentAdminInvalidationPlan,
  getAgentSystemSwitchState,
  getAdminRefundSelection,
  projectAgentBalance,
  validateAgentOfferDraft,
} from './admin'

function refundCode(
  id: number,
  agentUserID: number,
  expiredAt: number,
  status: AgentCode['status'] = 'unused'
): AgentCode {
  return {
    id,
    code: `code-${id}`,
    agent_user_id: agentUserID,
    order_id: 1,
    order_no: 'order-1',
    plan_id: 1,
    plan_title: 'Plan',
    status,
    code_visible: true,
    used_user_id: 0,
    created_at: 1,
    expired_at: expiredAt,
    redeemed_at: 0,
  }
}

describe('agent administration cache scope', () => {
  test('keeps mutation invalidation inside the signed-in admin and affected resource', () => {
    expect(agentAdminQueryKeys.agentsRoot(41)).toEqual([
      'agent-admin',
      41,
      'agents',
    ])
    expect(agentAdminQueryKeys.ledgerRoot(41, 9)).toEqual([
      'agent-admin',
      41,
      'ledger',
      9,
    ])
    expect(agentAdminQueryKeys.codesRoot(41)).toEqual([
      'agent-admin',
      41,
      'codes',
    ])
  })

  test('targets current agent workspace caches only when the mutation affects that user', () => {
    expect(getAgentAdminInvalidationPlan('offer', 41, 0)).toEqual([
      agentAdminQueryKeys.offers(41),
      agentQueryKeys.offers,
    ])
    expect(getAgentAdminInvalidationPlan('credit', 41, 9)).toEqual([
      agentAdminQueryKeys.agentsRoot(41),
      agentAdminQueryKeys.ledgerRoot(41, 9),
      agentAdminQueryKeys.reconciliation(41, 9),
    ])
    expect(getAgentAdminInvalidationPlan('limit', 41, 41)).toEqual([
      agentAdminQueryKeys.agentsRoot(41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
    ])
    expect(getAgentAdminInvalidationPlan('lifecycle', 41, 9)).toEqual([
      agentAdminQueryKeys.agentsRoot(41),
    ])
    expect(getAgentAdminInvalidationPlan('lifecycle', 41, 41)).toEqual([
      agentAdminQueryKeys.agentsRoot(41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
      agentAccessQueryKey(41),
    ])
    expect(getAgentAdminInvalidationPlan('credit', 41, 41)).toEqual([
      agentAdminQueryKeys.agentsRoot(41),
      agentAdminQueryKeys.ledgerRoot(41, 41),
      agentAdminQueryKeys.reconciliation(41, 41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
      agentUserQueryKey(agentQueryKeys.creditLogs, 41),
    ])
    expect(getAgentAdminInvalidationPlan('refund', 41, 41)).toEqual([
      agentAdminQueryKeys.codesRoot(41),
      agentAdminQueryKeys.ordersRoot(41),
      agentAdminQueryKeys.agentsRoot(41),
      agentAdminQueryKeys.ledgerRoot(41, 41),
      agentAdminQueryKeys.reconciliation(41, 41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
      agentUserQueryKey(agentQueryKeys.orders, 41),
      agentUserQueryKey(agentQueryKeys.codes, 41),
      agentUserQueryKey(agentQueryKeys.creditLogs, 41),
    ])
  })
})

describe('agent administration access', () => {
  test('allows admins to read and only super admins to mutate', () => {
    expect(getAgentAdminAccess(undefined)).toEqual({
      canRead: false,
      canMutate: false,
    })
    expect(getAgentAdminAccess(1)).toEqual({
      canRead: false,
      canMutate: false,
    })
    expect(getAgentAdminAccess(10)).toEqual({
      canRead: true,
      canMutate: false,
    })
    expect(getAgentAdminAccess(100)).toEqual({
      canRead: true,
      canMutate: true,
    })
  })

  test('never exposes the RootAuth feature switch to ordinary administrators', () => {
    expect(
      getAgentSystemSwitchState({
        canMutate: false,
        hasAuthoritativeStatus: true,
        statusError: false,
      })
    ).toBe('hidden')
    expect(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: false,
        statusError: false,
      })
    ).toBe('loading')
    expect(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: false,
        statusError: true,
      })
    ).toBe('error')
    expect(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: true,
        statusError: true,
      })
    ).toBe('ready')
  })
})

describe('credit adjustment confirmation', () => {
  test('projects decimal point balances exactly without number arithmetic', () => {
    expect(projectAgentBalance('9007199254740993.99', '0.02', 'credit')).toBe(
      '9007199254740994.01'
    )
    expect(projectAgentBalance('10.00', '3.45', 'debit')).toBe('6.55')
    expect(projectAgentBalance('1.00', '1.01', 'debit')).toBe('-0.01')
  })

  test('retains an idempotency key for retry and rotates on payload change', () => {
    let sequence = 0
    const uuid = () => `attempt-${++sequence}`
    const payload = {
      amount: '12.30',
      direction: 'credit' as const,
      reason: 'Opening balance',
    }
    const first = createCreditAttempt(undefined, payload, uuid)
    const retry = createCreditAttempt(first, { ...payload }, uuid)
    const changed = createCreditAttempt(
      first,
      { ...payload, amount: '12.31' },
      uuid
    )

    expect(first.idempotencyKey).toBe('attempt-1')
    expect(retry.idempotencyKey).toBe(first.idempotencyKey)
    expect(changed.idempotencyKey).toBe('attempt-2')
  })
})

describe('offer and refund boundaries', () => {
  test('accepts only complete offer terms at server boundaries', () => {
    expect(
      validateAgentOfferDraft({
        unitPrice: '0.01',
        codeValidDays: '1',
        refundFeeBps: '0',
      })
    ).toBe(true)
    expect(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3650',
        refundFeeBps: '10000',
      })
    ).toBe(true)
    expect(
      validateAgentOfferDraft({
        unitPrice: '0',
        codeValidDays: '1',
        refundFeeBps: '0',
      })
    ).toBe(false)
    expect(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3651',
        refundFeeBps: '0',
      })
    ).toBe(false)
    expect(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '2',
        refundFeeBps: '10001',
      })
    ).toBe(false)
  })

  test('permits a special refund only for unused codes owned by one agent', () => {
    const result = getAdminRefundSelection(
      [refundCode(11, 7, 1001), refundCode(12, 7, 1002)],
      1000
    )
    expect(result).toEqual({ agentUserID: 7, redemptionIDs: [11, 12] })
    expect(
      getAdminRefundSelection(
        [refundCode(11, 7, 1001), refundCode(12, 8, 1002)],
        1000
      )
    ).toBe(null)
    expect(
      getAdminRefundSelection([refundCode(11, 7, 1001, 'used')], 1000)
    ).toBe(null)
  })

  test('rejects unused codes at and before the expiry boundary', () => {
    expect(getAdminRefundSelection([refundCode(11, 7, 1000)], 1000)).toBe(null)
    expect(getAdminRefundSelection([refundCode(11, 7, 999)], 1000)).toBe(null)
    expect(getAdminRefundSelection([refundCode(11, 7, 1001)], 1000)).toEqual({
      agentUserID: 7,
      redemptionIDs: [11],
    })
  })
})

describe('agent administration URL state', () => {
  test('sanitizes invalid filters and preserves valid stable filters', () => {
    expect(
      agentAdminSearchSchema.parse({
        tab: 'orders',
        p: 3,
        agent_user_id: 12,
        status: 'completed',
      })
    ).toEqual({ tab: 'orders', p: 3, agent_user_id: 12, status: 'completed' })
    expect(
      agentAdminSearchSchema.parse({
        tab: 'unknown',
        p: -5,
        agent_user_id: Number.MAX_SAFE_INTEGER + 1,
        status: 'unknown',
      })
    ).toEqual({ tab: 'agents', p: 1 })
  })
})
