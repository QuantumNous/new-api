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
import { describe, expect, test } from 'bun:test'
import type { UserModelAccess } from '@/features/available-models'
import {
  buildBatchEditApiKeysPayload,
  canBatchEditApiKeyGroup,
  coordinateBatchEditApiKeys,
  getBatchGroupOptions,
  isBatchEditApiKeysAvailable,
  isBatchQuotaInputValid,
  type BatchEditApiKeysPayload,
  type BatchEditApiKeysSuccessEffects,
} from './api-key-batch-group'

function buildModelAccess(
  overrides: Partial<UserModelAccess> = {}
): UserModelAccess {
  return {
    scope_mode: 'selectable_group',
    identity_scope: null,
    identity_model_ids: [],
    identity_model_ratios: {},
    identity_default_ratio: null,
    create_default_scope: 'default',
    groups: [
      {
        id: 'default',
        label: 'Default',
        description: 'Default group',
        ratio: 1,
        model_ids: [],
        model_ratios: {},
      },
    ],
    account_model_ids: [],
    account_model_ratios: {},
    account_default_ratio: null,
    models: [],
    ...overrides,
  }
}

function createSuccessEffects() {
  const calls = {
    resetSelection: 0,
    refresh: 0,
    resetForm: 0,
    closeDialog: 0,
  }
  const successEffects: BatchEditApiKeysSuccessEffects = {
    resetSelection: () => {
      calls.resetSelection += 1
    },
    refresh: () => {
      calls.refresh += 1
    },
    resetForm: () => {
      calls.resetForm += 1
    },
    closeDialog: () => {
      calls.closeDialog += 1
    },
  }

  return { calls, successEffects }
}

describe('batch API key edits', () => {
  test('builds group-only, quota-only, and combined payloads', () => {
    expect(buildBatchEditApiKeysPayload([3, 9], { group: 'premium' })).toEqual({
      ids: [3, 9],
      group: 'premium',
    })
    expect(buildBatchEditApiKeysPayload([3, 9], { remain_quota: 0 })).toEqual({
      ids: [3, 9],
      remain_quota: 0,
    })
    expect(
      buildBatchEditApiKeysPayload([3, 9], {
        group: 'premium',
        remain_quota: 500000,
      })
    ).toEqual({ ids: [3, 9], group: 'premium', remain_quota: 500000 })
  })

  test('rejects invalid IDs, empty edits, and invalid finite quotas', () => {
    expect(() =>
      buildBatchEditApiKeysPayload([], { group: 'default' })
    ).toThrow()
    expect(() =>
      buildBatchEditApiKeysPayload(
        Array.from({ length: 101 }, (_, index) => index + 1),
        { group: 'default' }
      )
    ).toThrow()
    expect(() => buildBatchEditApiKeysPayload([1], {})).toThrow()
    expect(() => buildBatchEditApiKeysPayload([1], { group: '' })).toThrow()
    expect(() =>
      buildBatchEditApiKeysPayload([1], { remain_quota: -1 })
    ).toThrow()
    expect(() =>
      buildBatchEditApiKeysPayload([1], { remain_quota: Number.NaN })
    ).toThrow()
  })

  test('allows group editing only for usable selectable groups', () => {
    expect(canBatchEditApiKeyGroup(true, buildModelAccess())).toBe(true)
    expect(
      canBatchEditApiKeyGroup(
        true,
        buildModelAccess({ scope_mode: 'fixed_account' })
      )
    ).toBe(false)
    expect(
      canBatchEditApiKeyGroup(true, buildModelAccess({ groups: [] }))
    ).toBe(false)
    expect(canBatchEditApiKeyGroup(false, buildModelAccess())).toBe(false)
  })

  test('shows quota-only batch editing when the feature is enabled', () => {
    expect(isBatchEditApiKeysAvailable(true)).toBe(true)
    expect(isBatchEditApiKeysAvailable(false)).toBe(false)
    expect(canBatchEditApiKeyGroup(false, buildModelAccess())).toBe(false)
  })

  test('requires whole-number quota input in token display mode', () => {
    expect(isBatchQuotaInputValid('0', true)).toBe(true)
    expect(isBatchQuotaInputValid('12', true)).toBe(true)
    expect(isBatchQuotaInputValid('1.5', true)).toBe(false)
    expect(isBatchQuotaInputValid('1.5', false)).toBe(true)
    expect(isBatchQuotaInputValid('', false)).toBe(false)
  })

  test('maps model access groups to the shared combobox option shape', () => {
    expect(getBatchGroupOptions(buildModelAccess())).toEqual([
      {
        value: 'default',
        label: 'Default',
        desc: 'Default group',
        ratio: 1,
      },
    ])
  })

  test('runs all success effects once after the request succeeds', async () => {
    const requestedPayloads: BatchEditApiKeysPayload[] = []
    const effects = createSuccessEffects()
    const payload = { ids: [3, 9], group: 'premium', remain_quota: 0 }

    const result = await coordinateBatchEditApiKeys({
      request: async (requestPayload) => {
        requestedPayloads.push(requestPayload)
        return { success: true, data: 2 }
      },
      payload,
      successEffects: effects.successEffects,
    })

    expect(requestedPayloads).toEqual([payload])
    expect(result).toEqual({ success: true, count: 2 })
    expect(effects.calls).toEqual({
      resetSelection: 1,
      refresh: 1,
      resetForm: 1,
      closeDialog: 1,
    })
  })

  test('failure retains effects and permits a successful retry', async () => {
    const requestedPayloads: BatchEditApiKeysPayload[] = []
    const effects = createSuccessEffects()
    const payload = { ids: [3, 9], remain_quota: 0 }
    let attempt = 0
    const params = {
      request: async (requestPayload: BatchEditApiKeysPayload) => {
        requestedPayloads.push(requestPayload)
        attempt += 1
        if (attempt === 1) return { success: false, message: 'Edit rejected' }
        return { success: true, data: 2 }
      },
      payload,
      successEffects: effects.successEffects,
    }

    const firstResult = await coordinateBatchEditApiKeys(params)
    const retryResult = await coordinateBatchEditApiKeys(params)

    expect(requestedPayloads).toEqual([payload, payload])
    expect(firstResult).toEqual({ success: false, message: 'Edit rejected' })
    expect(retryResult).toEqual({ success: true, count: 2 })
    expect(effects.calls).toEqual({
      resetSelection: 1,
      refresh: 1,
      resetForm: 1,
      closeDialog: 1,
    })
  })
})
