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

import type { ApiKey } from '../types'
import {
  getApiKeyFormDefaultValues,
  SYSTEM_ROUTING_VALUE,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
  type ApiKeyFormValues,
} from './api-key-form'

function formValues(
  groupCandidates: string[],
  crossGroupRetry = true
): ApiKeyFormValues {
  return {
    name: 'routing-key',
    remain_quota_dollars: 10,
    expired_time: undefined,
    unlimited_quota: true,
    model_limits: [],
    allow_ips: '',
    group_candidates: groupCandidates,
    cross_group_retry: crossGroupRetry,
    tokenCount: 1,
  }
}

function apiKey(overrides: Partial<ApiKey>): ApiKey {
  return {
    id: 1,
    key: 'sk-masked',
    status: 1,
    name: 'routing-key',
    created_time: 1,
    accessed_time: 0,
    expired_time: -1,
    remain_quota: 0,
    unlimited_quota: true,
    used_quota: 0,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
    group: '',
    group_candidates: [],
    cross_group_retry: false,
    ...overrides,
  }
}

describe('API key routing form mapping', () => {
  test('starts new keys without a default group or cross-group retry', () => {
    const defaults = getApiKeyFormDefaultValues()

    assert.deepEqual(defaults.group_candidates, [])
    assert.equal(defaults.cross_group_retry, false)
  })

  test('maps fixed, ordered, and system routing to the API contract', () => {
    const fixed = transformFormDataToPayload(formValues(['openai-low']))
    assert.equal(fixed.group, 'openai-low')
    assert.deepEqual(fixed.group_candidates, ['openai-low'])
    assert.equal(fixed.cross_group_retry, false)

    const ordered = transformFormDataToPayload(
      formValues(['openai-low', 'claude-low'])
    )
    assert.equal(ordered.group, 'auto')
    assert.deepEqual(ordered.group_candidates, ['openai-low', 'claude-low'])
    assert.equal(ordered.cross_group_retry, true)

    const system = transformFormDataToPayload(
      formValues([SYSTEM_ROUTING_VALUE])
    )
    assert.equal(system.group, 'auto')
    assert.deepEqual(system.group_candidates, [])
    assert.equal(system.cross_group_retry, true)
  })

  test('preserves legacy system routing without freezing global candidates', () => {
    const defaults = transformApiKeyToFormDefaults(
      apiKey({ group: 'auto', group_candidates: [] })
    )
    assert.deepEqual(defaults.group_candidates, [SYSTEM_ROUTING_VALUE])

    const payload = transformFormDataToPayload(defaults)
    assert.equal(payload.group, 'auto')
    assert.deepEqual(payload.group_candidates, [])
  })

  test('maps a legacy account-group key to a visible concrete group', () => {
    const defaults = transformApiKeyToFormDefaults(
      apiKey({ group: '', group_candidates: [] }),
      'openai-low'
    )

    assert.deepEqual(defaults.group_candidates, ['openai-low'])
  })

  test('keeps the API candidate order when editing a multi-group key', () => {
    const defaults = transformApiKeyToFormDefaults(
      apiKey({
        group: 'auto',
        group_candidates: ['claude-low', 'openai-low'],
        cross_group_retry: true,
      })
    )
    assert.deepEqual(defaults.group_candidates, ['claude-low', 'openai-low'])

    const payload = transformFormDataToPayload(defaults)
    assert.deepEqual(payload.group_candidates, ['claude-low', 'openai-low'])
  })
})
