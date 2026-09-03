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

import type { ApiKey } from '@/features/keys/types'

import { canReuseEasyConnectKey, explainGroupRatio } from '../easy-connect'

function createApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    name: 'Easy setup',
    key: 'masked',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 1,
    accessed_time: 0,
    group: 'default',
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: true,
    model_limits: 'deepseek-v4,gpt-5.6',
    allow_ips: '',
    ...overrides,
  }
}

describe('easy connect group pricing copy', () => {
  it('turns raw multipliers into beginner-friendly discounts and markups', () => {
    expect(explainGroupRatio(0.8)).toEqual({
      kind: 'discount',
      fold: 8,
      percent: 20,
    })
    expect(explainGroupRatio(1)).toEqual({ kind: 'standard' })
    expect(explainGroupRatio(1.25)).toEqual({
      kind: 'premium',
      multiplier: 1.25,
      percent: 25,
    })
    expect(explainGroupRatio('')).toEqual({ kind: 'unknown' })
    expect(explainGroupRatio('automatic', true)).toEqual({ kind: 'auto' })
  })
})

describe('easy connect existing key reuse', () => {
  it('does not reuse a key whose implicit or custom automatic routes differ from the checked route', () => {
    expect(
      canReuseEasyConnectKey(
        createApiKey({ group: '' }),
        'deepseek-v4',
        'default'
      )
    ).toBe(false)
    expect(
      canReuseEasyConnectKey(
        createApiKey({ group: 'auto', auto_groups: ['codex'] }),
        'deepseek-v4',
        'auto'
      )
    ).toBe(false)
    expect(
      canReuseEasyConnectKey(
        createApiKey({ group: 'auto', auto_groups: null }),
        'deepseek-v4',
        'auto'
      )
    ).toBe(true)
  })

  it('reuses only active keys that match the selected group and model', () => {
    const apiKey = createApiKey()

    expect(canReuseEasyConnectKey(apiKey, 'deepseek-v4', 'default')).toBe(true)
    expect(canReuseEasyConnectKey(apiKey, 'claude-opus-4.6', 'default')).toBe(
      false
    )
    expect(canReuseEasyConnectKey(apiKey, 'deepseek-v4', 'vip')).toBe(false)
    expect(
      canReuseEasyConnectKey(
        createApiKey({ model_limits_enabled: false, model_limits: '' }),
        'claude-opus-4.6',
        'default'
      )
    ).toBe(true)
  })
})
