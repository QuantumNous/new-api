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
import type { TFunction } from 'i18next'
import { describe, expect, test } from 'vitest'

import type { ApiKey } from '../../types'
import {
  getApiKeyFormDefaultValues,
  getApiKeyFormSchema,
  resolveApiKeyGroup,
  transformApiKeyToFormDefaults,
} from '../api-key-form'

const t = ((key: string) => key) as TFunction

const legacyKeyWithoutGroup: ApiKey = {
  id: 7,
  name: 'legacy',
  key: 'sk-legacy',
  status: 1,
  remain_quota: 0,
  used_quota: 0,
  unlimited_quota: true,
  expired_time: -1,
  created_time: 1,
  accessed_time: 0,
  group: '',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}

describe('resolveApiKeyGroup', () => {
  test('prefers the user own group when it is selectable', () => {
    expect(resolveApiKeyGroup(['auto', 'default', 'vip'], 'vip')).toBe('vip')
  })

  test('falls back to default when the user group is not selectable', () => {
    expect(resolveApiKeyGroup(['auto', 'default', 'vip'], 'svip')).toBe(
      'default'
    )
  })

  test('falls back to the first ordinary group when default is absent', () => {
    expect(resolveApiKeyGroup(['auto', 'vip', 'svip'], 'removed')).toBe('vip')
  })

  test('falls back to auto when it is the only selectable group', () => {
    expect(resolveApiKeyGroup(['auto'], 'removed')).toBe('auto')
  })

  test('returns an empty group when no group is available', () => {
    expect(resolveApiKeyGroup([], 'default')).toBe('')
  })

  test('ignores an undefined user group', () => {
    expect(resolveApiKeyGroup(['default', 'vip'], undefined)).toBe('default')
  })
})

describe('API key group requirement', () => {
  test('rejects a create payload that carries no group', () => {
    const result = getApiKeyFormSchema(t).safeParse({
      ...getApiKeyFormDefaultValues(false),
      name: 'no group',
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues[0]?.path).toEqual(['group'])
    expect(result.error.issues[0]?.message).toBe('Please select a group')
  })

  test('accepts a create payload once a group is resolved', () => {
    const result = getApiKeyFormSchema(t).safeParse({
      ...getApiKeyFormDefaultValues(false),
      name: 'resolved group',
      group: resolveApiKeyGroup(['default', 'vip'], 'vip'),
    })

    expect(result.success).toBe(true)
  })

  test('keeps a legacy key group empty on edit so it can be resolved', () => {
    expect(
      transformApiKeyToFormDefaults(legacyKeyWithoutGroup, ['default'], 5).group
    ).toBe('')
  })
})
