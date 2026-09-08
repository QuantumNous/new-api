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
    assert.deepEqual(agentAdminQueryKeys.agentsRoot(41), [
      'agent-admin',
      41,
      'agents',
    ])
    assert.deepEqual(agentAdminQueryKeys.ledgerRoot(41, 9), [
      'agent-admin',
      41,
      'ledger',
      9,
    ])
    assert.deepEqual(agentAdminQueryKeys.codesRoot(41), [
      'agent-admin',
      41,
      'codes',
    ])
  })

  test('targets current agent workspace caches only when the mutation affects that user', () => {
    assert.deepEqual(getAgentAdminInvalidationPlan('offer', 41, 0), [
      agentAdminQueryKeys.offers(41),
      agentQueryKeys.offers,
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('credit', 41, 9), [
      agentAdminQueryKeys.agentsRoot(41),
      agentAdminQueryKeys.ledgerRoot(41, 9),
      agentAdminQueryKeys.reconciliation(41, 9),
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('limit', 41, 41), [
      agentAdminQueryKeys.agentsRoot(41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('lifecycle', 41, 9), [
      agentAdminQueryKeys.agentsRoot(41),
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('lifecycle', 41, 41), [
      agentAdminQueryKeys.agentsRoot(41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
      agentAccessQueryKey(41),
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('credit', 41, 41), [
      agentAdminQueryKeys.agentsRoot(41),
      agentAdminQueryKeys.ledgerRoot(41, 41),
      agentAdminQueryKeys.reconciliation(41, 41),
      agentUserQueryKey(agentQueryKeys.overview, 41),
      agentUserQueryKey(agentQueryKeys.creditLogs, 41),
    ])
    assert.deepEqual(getAgentAdminInvalidationPlan('refund', 41, 41), [
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
    assert.deepEqual(getAgentAdminAccess(undefined), {
      canRead: false,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(1), {
      canRead: false,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(10), {
      canRead: true,
      canMutate: false,
    })
    assert.deepEqual(getAgentAdminAccess(100), {
      canRead: true,
      canMutate: true,
    })
  })

  test('never exposes the RootAuth feature switch to ordinary administrators', () => {
    assert.equal(
      getAgentSystemSwitchState({
        canMutate: false,
        hasAuthoritativeStatus: true,
        statusError: false,
      }),
      'hidden'
    )
    assert.equal(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: false,
        statusError: false,
      }),
      'loading'
    )
    assert.equal(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: false,
        statusError: true,
      }),
      'error'
    )
    assert.equal(
      getAgentSystemSwitchState({
        canMutate: true,
        hasAuthoritativeStatus: true,
        statusError: true,
      }),
      'ready'
    )
  })
})

describe('credit adjustment confirmation', () => {
  test('projects decimal point balances exactly without number arithmetic', () => {
    assert.equal(
      projectAgentBalance('9007199254740993.99', '0.02', 'credit'),
      '9007199254740994.01'
    )
    assert.equal(projectAgentBalance('10.00', '3.45', 'debit'), '6.55')
    assert.equal(projectAgentBalance('1.00', '1.01', 'debit'), '-0.01')
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

    assert.equal(first.idempotencyKey, 'attempt-1')
    assert.equal(retry.idempotencyKey, first.idempotencyKey)
    assert.equal(changed.idempotencyKey, 'attempt-2')
  })
})

describe('offer and refund boundaries', () => {
  test('accepts only complete offer terms at server boundaries', () => {
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '0.01',
        codeValidDays: '1',
        refundFeeBps: '0',
      }),
      true
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3650',
        refundFeeBps: '10000',
      }),
      true
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '0',
        codeValidDays: '1',
        refundFeeBps: '0',
      }),
      false
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '3651',
        refundFeeBps: '0',
      }),
      false
    )
    assert.equal(
      validateAgentOfferDraft({
        unitPrice: '1',
        codeValidDays: '2',
        refundFeeBps: '10001',
      }),
      false
    )
  })

  test('permits a special refund only for unused codes owned by one agent', () => {
    const result = getAdminRefundSelection(
      [refundCode(11, 7, 1001), refundCode(12, 7, 1002)],
      1000
    )
    assert.deepEqual(result, { agentUserID: 7, redemptionIDs: [11, 12] })
    assert.equal(
      getAdminRefundSelection(
        [refundCode(11, 7, 1001), refundCode(12, 8, 1002)],
        1000
      ),
      null
    )
    assert.equal(
      getAdminRefundSelection([refundCode(11, 7, 1001, 'used')], 1000),
      null
    )
  })

  test('rejects unused codes at and before the expiry boundary', () => {
    assert.equal(getAdminRefundSelection([refundCode(11, 7, 1000)], 1000), null)
    assert.equal(getAdminRefundSelection([refundCode(11, 7, 999)], 1000), null)
    assert.deepEqual(getAdminRefundSelection([refundCode(11, 7, 1001)], 1000), {
      agentUserID: 7,
      redemptionIDs: [11],
    })
  })
})

describe('agent administration URL state', () => {
  test('sanitizes invalid filters and preserves valid stable filters', () => {
    assert.deepEqual(
      agentAdminSearchSchema.parse({
        tab: 'orders',
        p: 3,
        agent_user_id: 12,
        status: 'completed',
      }),
      { tab: 'orders', p: 3, agent_user_id: 12, status: 'completed' }
    )
    assert.deepEqual(
      agentAdminSearchSchema.parse({
        tab: 'unknown',
        p: -5,
        agent_user_id: Number.MAX_SAFE_INTEGER + 1,
        status: 'unknown',
      }),
      { tab: 'agents', p: 1 }
    )
  })
})
