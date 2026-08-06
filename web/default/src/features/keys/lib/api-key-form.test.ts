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
import type { TFunction } from 'i18next'
import type { ApiKey } from '../types'
import {
  API_KEY_FORM_DEFAULT_VALUES,
  getApiKeyFormDefaultValues,
  getApiKeyFormSchema,
  transformApiKeyToFormDefaults,
  transformFormDataToPayload,
} from './api-key-form'

function buildApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    name: 'contract-key',
    key: 'masked-key',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 0,
    group: 'default',
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    model_blacklist_enabled: false,
    model_blacklist: '',
    allow_ips: '',
    ...overrides,
  }
}

function roundTripApiKey(apiKey: ApiKey, canUseGroups = true) {
  return transformFormDataToPayload(
    transformApiKeyToFormDefaults(apiKey),
    canUseGroups
  )
}

const translate = ((key: string) => key) as TFunction

describe('API key form explicit allowlist field', () => {
  test('defaults model_limits_enabled to false', () => {
    expect(
      Reflect.get(API_KEY_FORM_DEFAULT_VALUES, 'model_limits_enabled')
    ).toBe(false)
  })

  test('schema preserves an explicit model_limits_enabled value', () => {
    const parsed = getApiKeyFormSchema(translate).parse({
      ...API_KEY_FORM_DEFAULT_VALUES,
      name: 'schema-contract',
      model_limits_enabled: true,
    })

    expect(Reflect.get(parsed, 'model_limits_enabled')).toBe(true)
  })

  test('API defaults preserve an explicitly disabled non-empty allowlist', () => {
    const defaults = transformApiKeyToFormDefaults(
      buildApiKey({
        model_limits_enabled: false,
        model_limits: 'gpt-5.5',
      })
    )

    expect(Reflect.get(defaults, 'model_limits_enabled')).toBe(false)
    expect(defaults.model_limits).toEqual(['gpt-5.5'])
  })

  test('API defaults preserve an enabled non-empty allowlist', () => {
    const defaults = transformApiKeyToFormDefaults(
      buildApiKey({
        model_limits_enabled: true,
        model_limits: 'gpt-5.5',
      })
    )

    expect(Reflect.get(defaults, 'model_limits_enabled')).toBe(true)
    expect(defaults.model_limits).toEqual(['gpt-5.5'])
  })

  test('API defaults preserve an enabled empty allowlist', () => {
    const defaults = transformApiKeyToFormDefaults(
      buildApiKey({
        model_limits_enabled: true,
        model_limits: '',
      })
    )

    expect(Reflect.get(defaults, 'model_limits_enabled')).toBe(true)
    expect(defaults.model_limits).toEqual([])
  })
})

describe('API key form group policy', () => {
  test('uses the explicit create scope without inferring auto defaults', () => {
    expect(getApiKeyFormDefaultValues(true, 'standard')).toMatchObject({
      group: 'standard',
      cross_group_retry: false,
    })
    expect(getApiKeyFormDefaultValues(false, 'auto')).toMatchObject({
      group: 'auto',
      cross_group_retry: true,
    })
    expect(getApiKeyFormDefaultValues(true, null)).toMatchObject({
      group: '',
      cross_group_retry: false,
    })
  })

  test('forces PLG group and disables cross-group retry', () => {
    const payload = transformFormDataToPayload(
      {
        ...transformApiKeyToFormDefaults(
          buildApiKey({ group: 'auto', cross_group_retry: true })
        ),
      },
      false
    )

    expect(payload.group).toBe('plg')
    expect(payload.cross_group_retry).toBe(false)
  })

  test('preserves cross-group retry for the auto group', () => {
    const payload = roundTripApiKey(
      buildApiKey({ group: 'auto', cross_group_retry: true })
    )

    expect(payload.group).toBe('auto')
    expect(payload.cross_group_retry).toBe(true)
  })

  test('preserves a legacy empty token group for identity-scope resolution', () => {
    const defaults = transformApiKeyToFormDefaults(buildApiKey({ group: '' }))
    const payload = transformFormDataToPayload(defaults)

    expect(defaults.group).toBe('')
    expect(payload.group).toBe('')
  })
})

describe('API key form model allowlist round-trip', () => {
  test('preserves an explicit disabled allowlist with retained model entries', () => {
    const payload = roundTripApiKey(
      buildApiKey({
        model_limits_enabled: false,
        model_limits: 'gpt-5.5',
      })
    )

    expect(payload.model_limits_enabled).toBe(false)
    expect(payload.model_limits).toBe('gpt-5.5')
  })

  test('preserves an enabled non-empty allowlist', () => {
    const payload = roundTripApiKey(
      buildApiKey({
        model_limits_enabled: true,
        model_limits: 'gpt-5.5,claude-sonnet-4-6',
      })
    )

    expect(payload.model_limits_enabled).toBe(true)
    expect(payload.model_limits).toBe('gpt-5.5,claude-sonnet-4-6')
  })

  test('preserves an enabled empty allowlist as zero model access', () => {
    const payload = roundTripApiKey(
      buildApiKey({
        model_limits_enabled: true,
        model_limits: '',
      })
    )

    expect(payload.model_limits_enabled).toBe(true)
    expect(payload.model_limits).toBe('')
  })
})

describe('API key form model blacklist round-trip', () => {
  test('preserves an enabled blacklist', () => {
    const payload = roundTripApiKey(
      buildApiKey({
        model_blacklist_enabled: true,
        model_blacklist: 'gpt-5.5,claude-sonnet-4-6',
      })
    )

    expect(payload.model_blacklist_enabled).toBe(true)
    expect(payload.model_blacklist).toBe('gpt-5.5,claude-sonnet-4-6')
  })

  test('preserves a disabled blacklist with retained entries', () => {
    const payload = roundTripApiKey(
      buildApiKey({
        model_blacklist_enabled: false,
        model_blacklist: 'gpt-5.5',
      })
    )

    expect(payload.model_blacklist_enabled).toBe(false)
    expect(payload.model_blacklist).toBe('gpt-5.5')
  })
})
