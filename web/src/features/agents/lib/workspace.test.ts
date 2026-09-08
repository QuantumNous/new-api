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

import type { AgentCode } from '../types'
import {
  AgentIdempotencyKeyStore,
  agentMutationInvalidationKeys,
  agentUserQueryKey,
  agentWorkspaceSearchSchema,
  canChangeAgentDialogOpen,
  downloadAgentExport,
  getAgentQueryView,
  getAgentRouteGateState,
  isRefundableAgentCode,
  localDateInputToTimestamp,
  retainSameAgentPage,
  resetAgentDialogLifecycle,
  retryAgentRouteGate,
  timestampToLocalDateInput,
  toggleRefundSelection,
} from './workspace'

const code = (overrides: Partial<AgentCode> = {}): AgentCode => ({
  id: 1,
  code: 'pkg-code',
  agent_user_id: 2,
  order_id: 3,
  order_no: 'AG-3',
  plan_id: 4,
  plan_title: 'Plan',
  status: 'unused',
  code_visible: true,
  used_user_id: 0,
  created_at: 10,
  expired_at: 200,
  redeemed_at: 0,
  ...overrides,
})

describe('agent workspace URL state', () => {
  test('normalizes invalid pagination and filter values to safe defaults', () => {
    assert.deepEqual(
      agentWorkspaceSearchSchema.parse({
        tab: 'codes',
        p: -2,
        page_size: 999,
        plan_id: 0,
        code_status: 'unknown',
      }),
      {
        tab: 'codes',
        p: 1,
        page_size: 20,
      }
    )
  })

  test('accepts customer management and customer log URL state', () => {
    assert.deepEqual(
      agentWorkspaceSearchSchema.parse({
        tab: 'customers',
        customer_keyword: 'alice',
        customer_sort_by: 'remaining_quota',
        customer_sort_order: 'asc',
      }),
      {
        tab: 'customers',
        customer_keyword: 'alice',
        customer_sort_by: 'remaining_quota',
        customer_sort_order: 'asc',
      }
    )
    assert.deepEqual(
      agentWorkspaceSearchSchema.parse({
        tab: 'customer-logs',
        customer_id: 12,
        customer_username: 'alice',
        log_type: 2,
        model_name: 'gpt-5',
      }),
      {
        tab: 'customer-logs',
        customer_id: 12,
        customer_username: 'alice',
        log_type: 2,
        model_name: 'gpt-5',
      }
    )
  })

  test('round-trips date filters in the application-local calendar', () => {
    const timestamp = localDateInputToTimestamp('2026-07-20')
    assert.notEqual(timestamp, undefined)
    assert.equal(timestampToLocalDateInput(timestamp), '2026-07-20')
    assert.equal(localDateInputToTimestamp(''), undefined)
  })
})

describe('agent route gate', () => {
  test('waits for authoritative status instead of denying from placeholder data', () => {
    assert.equal(
      getAgentRouteGateState({
        statusEnabled: false,
        statusAuthoritative: false,
        statusPending: true,
        statusError: false,
        accessPending: false,
        accessDenied: false,
        accessError: false,
        accessReady: false,
      }),
      'loading'
    )
    assert.equal(
      getAgentRouteGateState({
        statusEnabled: true,
        statusAuthoritative: true,
        statusPending: false,
        statusError: false,
        accessPending: false,
        accessDenied: false,
        accessError: false,
        accessReady: true,
      }),
      'ready'
    )
  })

  test('keeps authoritative status and access data ready during background refresh', () => {
    const ready = {
      statusEnabled: true,
      statusAuthoritative: true,
      statusPending: false,
      statusError: false,
      accessPending: false,
      accessDenied: false,
      accessError: false,
      accessReady: true,
    }
    assert.equal(
      getAgentRouteGateState({ ...ready, statusPending: true }),
      'ready'
    )
    assert.equal(
      getAgentRouteGateState({ ...ready, accessError: true }),
      'ready'
    )
  })

  test('denies refreshed disabled or null access but errors on initial failures', () => {
    const base = {
      statusEnabled: true,
      statusAuthoritative: true,
      statusPending: false,
      statusError: false,
      accessPending: false,
      accessDenied: false,
      accessError: false,
      accessReady: false,
    }
    assert.equal(
      getAgentRouteGateState({
        ...base,
        statusAuthoritative: false,
        statusError: true,
      }),
      'error'
    )
    assert.equal(
      getAgentRouteGateState({ ...base, accessError: true }),
      'error'
    )
    assert.equal(
      getAgentRouteGateState({ ...base, accessDenied: true }),
      'denied'
    )
    assert.equal(
      getAgentRouteGateState({
        ...base,
        statusEnabled: false,
        accessError: true,
      }),
      'denied'
    )
  })

  test('retries both status and access after either gate failure', async () => {
    let statusRetries = 0
    let accessRetries = 0
    await retryAgentRouteGate(
      async () => {
        statusRetries += 1
      },
      async () => {
        accessRetries += 1
      }
    )
    assert.equal(statusRetries, 1)
    assert.equal(accessRetries, 1)
  })
})

describe('agent refund selection', () => {
  test('allows only visible, unused, unexpired inventory', () => {
    assert.equal(isRefundableAgentCode(code(), 100), true)
    assert.equal(isRefundableAgentCode(code({ expired_at: 100 }), 100), false)
    assert.equal(isRefundableAgentCode(code({ status: 'used' }), 100), false)
    assert.equal(
      isRefundableAgentCode(code({ code_visible: false }), 100),
      false
    )
  })

  test('keeps cross-page IDs and enforces the 100-code ceiling', () => {
    let selected = new Set(Array.from({ length: 100 }, (_, index) => index + 1))
    const rejected = toggleRefundSelection(selected, 101, true)
    assert.equal(rejected.changed, false)
    assert.equal(rejected.selection.size, 100)

    selected = toggleRefundSelection(selected, 50, false).selection
    const accepted = toggleRefundSelection(selected, 101, true)
    assert.equal(accepted.changed, true)
    assert.equal(accepted.selection.has(1), true)
    assert.equal(accepted.selection.has(101), true)
    assert.equal(accepted.selection.size, 100)
  })
})

describe('agent mutation stability', () => {
  test('retains purchase retry idempotency and rotates on offer switch or success', () => {
    const generated = ['key-1', 'key-2', 'key-3']
    const store = new AgentIdempotencyKeyStore(
      () => generated.shift() ?? 'unexpected-key'
    )

    assert.equal(store.keyFor('plan=1&quantity=2'), 'key-1')
    assert.equal(store.keyFor('plan=1&quantity=2'), 'key-1')
    assert.equal(store.keyFor('plan=2&quantity=2'), 'key-2')
    store.complete()
    assert.equal(store.keyFor('plan=2&quantity=2'), 'key-3')
  })

  test('invalidates only the four agent read families', () => {
    assert.deepEqual(agentMutationInvalidationKeys, [
      ['agent', 'overview'],
      ['agent', 'orders'],
      ['agent', 'codes'],
      ['agent', 'credit-logs'],
    ])
  })

  test('blocks pending close and rotates a second refund after close and reopen', () => {
    const generated = ['key-1', 'key-2']
    const store = new AgentIdempotencyKeyStore(
      () => generated.shift() ?? 'unexpected-key'
    )
    assert.equal(store.keyFor('refund=1'), 'key-1')
    assert.equal(canChangeAgentDialogOpen(false, true), false)
    assert.equal(canChangeAgentDialogOpen(false, false), true)
    resetAgentDialogLifecycle(store)
    assert.equal(store.keyFor('refund=1'), 'key-2')
  })
})

describe('agent query presentation', () => {
  test('shows errors before empty states and allows retry', () => {
    assert.equal(
      getAgentQueryView({ loading: false, error: true, hasData: false }),
      'error'
    )
    assert.equal(
      getAgentQueryView({ loading: false, error: false, hasData: false }),
      'empty'
    )
  })

  test('never retains user A page data for user B', () => {
    const page = { items: [{ id: 1 }], total: 1 }
    assert.equal(retainSameAgentPage(2, 1, page), undefined)
    assert.equal(retainSameAgentPage(1, 1, page), page)
    assert.notDeepEqual(
      agentUserQueryKey(['agent', 'codes'], 1, 1),
      agentUserQueryKey(['agent', 'codes'], 2, 1)
    )
  })

  test('revokes the CSV object URL even when the browser click fails', () => {
    const revoked: string[] = []
    assert.throws(() =>
      downloadAgentExport(
        { blob: new Blob(['code\n']), filename: 'agent-codes.csv' },
        {
          createObjectURL: () => 'blob:agent-codes',
          revokeObjectURL: (url) => revoked.push(url),
          click: () => {
            throw new Error('blocked download')
          },
        }
      )
    )
    assert.deepEqual(revoked, ['blob:agent-codes'])
  })
})
