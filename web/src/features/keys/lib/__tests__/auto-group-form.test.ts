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

import type { TFunction } from 'i18next'

import { apiKeySchema, type ApiKey } from '../../types'
import {
  getApiKeyFormDefaultValues,
  getApiKeyFormSchema,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
} from '../api-key-form'

const t = ((key: string, options?: Record<string, unknown>) => {
  if (options?.max !== undefined) {
    return key.replace('{{max}}', String(options.max))
  }
  return key
}) as TFunction

const baseApiKey: ApiKey = {
  id: 1,
  name: 'test',
  key: 'sk-test',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 1,
  accessed_time: 0,
  group: 'auto',
  auto_groups: null,
  cross_group_retry: true,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}

describe('API key Auto group form mapping', () => {
  test('treats legacy token responses without auto_groups as inheritance', () => {
    const legacyApiKey: Record<string, unknown> = { ...baseApiKey }
    delete legacyApiKey.auto_groups

    assert.equal(apiKeySchema.parse(legacyApiKey).auto_groups, null)
  })

  test('creates an Auto token that inherits the global order', () => {
    const defaults = getApiKeyFormDefaultValues(true)

    assert.equal(defaults.group, 'auto')
    assert.equal(defaults.auto_groups_mode, 'inherit')
    assert.deepEqual(defaults.auto_groups, [])
    assert.deepEqual(transformFormDataToPayload(defaults).auto_groups, [])
  })

  test('maps omitted, null, and empty snapshots to inheritance on edit', () => {
    const legacyApiKey: Record<string, unknown> = { ...baseApiKey }
    delete legacyApiKey.auto_groups
    const inheritedApiKeys = [
      apiKeySchema.parse(legacyApiKey),
      baseApiKey,
      { ...baseApiKey, auto_groups: [] },
    ]

    for (const apiKey of inheritedApiKeys) {
      const defaults = transformApiKeyToFormDefaults(
        apiKey,
        ['default', 'vip'],
        2
      )

      assert.equal(defaults.auto_groups_mode, 'inherit')
      assert.deepEqual(defaults.auto_groups, [])
    }
  })

  test('filters a stored snapshot before applying a lowered limit', () => {
    const defaults = transformApiKeyToFormDefaults(
      {
        ...baseApiKey,
        auto_groups: ['revoked', 'vip', 'default'],
      },
      ['default', 'vip'],
      2
    )

    assert.equal(defaults.auto_groups_mode, 'custom')
    assert.deepEqual(defaults.auto_groups, ['vip', 'default'])
  })

  test('keeps a fully filtered snapshot custom and rejects it until resolved', () => {
    const defaults = transformApiKeyToFormDefaults(
      { ...baseApiKey, auto_groups: ['revoked'] },
      ['default'],
      2
    )

    assert.equal(defaults.auto_groups_mode, 'custom')
    assert.deepEqual(defaults.auto_groups, [])

    const result = getApiKeyFormSchema(t, 2).safeParse(defaults)
    assert.equal(result.success, false)
    if (result.success) return
    assert.deepEqual(result.error.issues[0]?.path, ['auto_groups'])
    assert.equal(
      result.error.issues[0]?.message,
      'Select at least one Auto group or restore global Auto.'
    )
  })

  test('submits a valid custom snapshot in its configured order', () => {
    const custom = {
      ...getApiKeyFormDefaultValues(true),
      auto_groups_mode: 'custom' as const,
      auto_groups: ['vip', 'default'],
    }

    assert.deepEqual(transformFormDataToPayload(custom).auto_groups, [
      'vip',
      'default',
    ])
  })

  test('submits an empty array for inheritance and for non-Auto groups', () => {
    const inherited = getApiKeyFormDefaultValues(true)
    assert.deepEqual(transformFormDataToPayload(inherited).auto_groups, [])

    const nonAuto = {
      ...inherited,
      group: 'default',
      auto_groups_mode: 'custom' as const,
      auto_groups: ['vip'],
    }
    assert.deepEqual(transformFormDataToPayload(nonAuto).auto_groups, [])
    assert.equal(transformFormDataToPayload(nonAuto).cross_group_retry, false)
  })

  test('rejects snapshots over the configured limit', () => {
    const result = getApiKeyFormSchema(t, 1).safeParse({
      ...getApiKeyFormDefaultValues(true),
      name: 'limited token',
      auto_groups_mode: 'custom',
      auto_groups: ['default', 'vip'],
    })

    assert.equal(result.success, false)
    if (result.success) return
    assert.equal(result.error.issues[0]?.path[0], 'auto_groups')
    assert.equal(
      result.error.issues[0]?.message,
      'Select at most 1 Auto groups'
    )
  })

  test('rejects duplicate custom groups', () => {
    const result = getApiKeyFormSchema(t).safeParse({
      ...getApiKeyFormDefaultValues(true),
      name: 'duplicate token',
      auto_groups_mode: 'custom',
      auto_groups: ['vip', 'vip'],
    })

    assert.equal(result.success, false)
    if (result.success) return
    assert.equal(
      result.error.issues[0]?.message,
      'Auto groups must not contain duplicates'
    )
  })
})
