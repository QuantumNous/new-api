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
import type { ApiKey } from '../types'
import {
  getApiKeyCallableModels,
  getApiKeyModelScopeSummary,
  isCurrentAccountModelScope,
  shouldShowApiKeyGroupColumn,
} from './api-key-model-scope'

function buildAccess(
  overrides: Partial<UserModelAccess> = {}
): UserModelAccess {
  return {
    scope_mode: 'selectable_group',
    identity_scope: 'identity',
    identity_model_ids: ['identity-model'],
    identity_model_ratios: { 'identity-model': 0.5 },
    identity_default_ratio: 0,
    create_default_scope: 'auto',
    groups: [
      {
        id: 'standard',
        label: 'Standard',
        ratio: 1,
        model_ids: ['standard-model', 'wildcard-model-*', 'retired-model'],
        model_ratios: { 'standard-model': 0, 'wildcard-model-*': 0.7 },
      },
      {
        id: 'auto',
        label: 'Auto',
        ratio: null,
        model_ids: ['standard-model', 'auto-model'],
        model_ratios: {},
      },
    ],
    account_model_ids: [],
    account_model_ratios: {},
    account_default_ratio: null,
    models: [
      {
        id: 'standard-model',
        allowlist_match_key: 'standard-model',
        vendor: null,
        supported_endpoint_types: ['openai'],
        availability_status: 'available',
      },
      {
        id: 'wildcard-model-*',
        allowlist_match_key: 'wildcard-model',
        vendor: null,
        supported_endpoint_types: ['openai'],
        availability_status: 'available',
      },
      {
        id: 'auto-model',
        allowlist_match_key: 'auto-model',
        vendor: null,
        supported_endpoint_types: ['anthropic'],
        availability_status: 'available',
      },
      {
        id: 'identity-model',
        allowlist_match_key: 'identity-model',
        vendor: null,
        supported_endpoint_types: ['gemini'],
        availability_status: 'available',
      },
      {
        id: 'retired-model',
        allowlist_match_key: 'retired-model',
        vendor: null,
        supported_endpoint_types: ['openai'],
        availability_status: 'official_unsupported',
      },
    ],
    ...overrides,
  }
}

function buildApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: 1,
    name: 'test-key',
    key: 'masked',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 0,
    accessed_time: 0,
    group: 'standard',
    cross_group_retry: false,
    model_limits_enabled: false,
    model_limits: '',
    allow_ips: '',
    ...overrides,
  }
}

describe('API key model scope summary', () => {
  test('summarizes ordinary and auto scopes without an allowlist', () => {
    const access = buildAccess()

    const ordinary = getApiKeyModelScopeSummary(access, buildApiKey())
    const auto = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ group: 'auto' })
    )

    expect(ordinary.labelKind).toBe('all-group')
    expect(ordinary.modelRatios).toEqual({
      'standard-model': 0,
      'wildcard-model-*': 0.7,
    })
    expect(ordinary.defaultRatio).toBe(1)
    expect(ordinary.totalModels.map((model) => model.id)).toEqual([
      'standard-model',
      'wildcard-model-*',
    ])
    expect(auto.labelKind).toBe('all-group')
    expect(auto.modelRatios).toEqual({})
    expect(auto.defaultRatio).toBeNull()
    expect(auto.totalModels.map((model) => model.id)).toEqual([
      'standard-model',
      'auto-model',
    ])
  })

  test('uses identity models for legacy empty groups', () => {
    const summary = getApiKeyModelScopeSummary(
      buildAccess(),
      buildApiKey({ group: '' })
    )

    expect(summary.labelKind).toBe('all-account')
    expect(summary.effectiveModels.map((model) => model.id)).toEqual([
      'identity-model',
    ])
    expect(summary.modelRatios).toEqual({ 'identity-model': 0.5 })
    expect(summary.defaultRatio).toBe(0)
  })

  test('uses the account summary and hides groups for identity-only access', () => {
    const access = buildAccess({ groups: [], create_default_scope: null })
    const summary = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ group: '' })
    )

    expect(summary.labelKind).toBe('all-account')
    expect(summary.effectiveModels.map((model) => model.id)).toEqual([
      'identity-model',
    ])
    expect(shouldShowApiKeyGroupColumn(access, true)).toBeFalse()
  })

  test('fails closed for a non-empty unknown group when no groups are selectable', () => {
    const access = buildAccess({ groups: [], create_default_scope: null })
    const summary = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ group: 'removed-group' })
    )

    expect(isCurrentAccountModelScope(access, 'removed-group')).toBeFalse()
    expect(summary.labelKind).toBe('empty')
    expect(summary.totalModels).toEqual([])
    expect(summary.effectiveModels).toEqual([])
  })

  test('uses the account scope for PLG without exposing its internal group', () => {
    const access = buildAccess({
      scope_mode: 'fixed_account',
      identity_scope: null,
      identity_model_ids: [],
      create_default_scope: null,
      groups: [],
      account_model_ids: ['standard-model', 'auto-model'],
      account_model_ratios: { 'standard-model': 0.25 },
      account_default_ratio: 0,
    })
    const summary = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ group: 'plg' })
    )

    expect(summary.labelKind).toBe('all-account')
    expect(summary.totalModels.map((model) => model.id)).toEqual([
      'standard-model',
      'auto-model',
    ])
    expect(summary.modelRatios).toEqual({ 'standard-model': 0.25 })
    expect(summary.defaultRatio).toBe(0)
    expect(shouldShowApiKeyGroupColumn(access, false)).toBeFalse()
    expect(isCurrentAccountModelScope(access, 'plg')).toBeTrue()
  })

  test('shows the group column only for selectable non-empty scopes', () => {
    expect(shouldShowApiKeyGroupColumn(buildAccess(), true)).toBeTrue()
    expect(shouldShowApiKeyGroupColumn(buildAccess(), false)).toBeFalse()
    expect(shouldShowApiKeyGroupColumn(undefined, true)).toBeFalse()
  })

  test('distinguishes allowlist off, on, and enabled-empty', () => {
    const access = buildAccess()
    const off = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ model_limits: 'standard-model' })
    )
    const on = getApiKeyModelScopeSummary(
      access,
      buildApiKey({
        model_limits_enabled: true,
        model_limits: 'wildcard-model',
      })
    )
    const enabledEmpty = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ model_limits_enabled: true, model_limits: '' })
    )

    expect(off.labelKind).toBe('all-group')
    expect(off.effectiveModels).toHaveLength(2)
    expect(on.labelKind).toBe('limited')
    expect(on.effectiveModels.map((model) => model.id)).toEqual([
      'wildcard-model-*',
    ])
    expect(on.modelRatios).toEqual({
      'standard-model': 0,
      'wildcard-model-*': 0.7,
    })
    expect(on.defaultRatio).toBe(1)
    expect(enabledEmpty.labelKind).toBe('empty')
    expect(enabledEmpty.effectiveModels).toEqual([])
    expect(enabledEmpty.totalModels).toHaveLength(2)
  })

  test('excludes officially unsupported models from callable summaries', () => {
    const access = buildAccess()
    const unrestricted = getApiKeyModelScopeSummary(access, buildApiKey())
    const allowlisted = getApiKeyModelScopeSummary(
      access,
      buildApiKey({
        model_limits_enabled: true,
        model_limits: 'retired-model',
      })
    )

    expect(unrestricted.totalModels.map((model) => model.id)).toEqual([
      'standard-model',
      'wildcard-model-*',
    ])
    expect(unrestricted.effectiveModels).toHaveLength(2)
    expect(allowlisted.totalModels).toHaveLength(2)
    expect(allowlisted.effectiveModels).toEqual([])
  })

  test('fails closed for unknown groups and scope-external allowlist entries', () => {
    const access = buildAccess()
    const unknown = getApiKeyModelScopeSummary(
      access,
      buildApiKey({ group: 'removed-group' })
    )
    const outsideScope = getApiKeyModelScopeSummary(
      access,
      buildApiKey({
        model_limits_enabled: true,
        model_limits: 'auto-model',
      })
    )

    expect(unknown.labelKind).toBe('empty')
    expect(unknown.totalModels).toEqual([])
    expect(unknown.effectiveModels).toEqual([])
    expect(outsideScope.labelKind).toBe('empty')
    expect(outsideScope.totalModels).toHaveLength(2)
    expect(outsideScope.effectiveModels).toEqual([])
  })

  test('returns only strict callable models for CC Switch options', () => {
    const access = buildAccess()
    const fixedAccess = buildAccess({
      scope_mode: 'fixed_account',
      groups: [],
      identity_model_ids: [],
      account_model_ids: ['auto-model'],
    })

    expect(getApiKeyCallableModels(undefined, buildApiKey())).toEqual([])
    expect(
      getApiKeyCallableModels(access, buildApiKey()).map((model) => model.id)
    ).toEqual(['standard-model', 'wildcard-model-*'])
    expect(
      getApiKeyCallableModels(access, buildApiKey({ group: '' })).map(
        (model) => model.id
      )
    ).toEqual(['identity-model'])
    expect(
      getApiKeyCallableModels(fixedAccess, buildApiKey({ group: 'plg' })).map(
        (model) => model.id
      )
    ).toEqual(['auto-model'])
    expect(
      getApiKeyCallableModels(
        access,
        buildApiKey({ model_limits_enabled: true, model_limits: '' })
      )
    ).toEqual([])
    expect(
      getApiKeyCallableModels(access, buildApiKey({ group: 'removed-group' }))
    ).toEqual([])
  })
})
