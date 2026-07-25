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
  getApiKeyModelAccessState,
  getApiKeyModelAllowlistOptions,
  getApiKeyModelPreviewCopy,
  hasUsableApiKeyModelAccess,
} from './api-key-model-access'

function buildAccess(
  overrides: Partial<UserModelAccess> = {}
): UserModelAccess {
  return {
    scope_mode: 'selectable_group',
    identity_scope: 'identity',
    identity_model_ids: ['identity-model'],
    identity_model_ratios: { 'identity-model': 0.5 },
    identity_default_ratio: 0,
    create_default_scope: 'ordinary',
    groups: [
      {
        id: 'ordinary',
        label: 'Ordinary',
        ratio: 1,
        model_ids: [
          'scope-model',
          'scope-variant',
          'retired-variant',
          'retired-model',
        ],
        model_ratios: { 'scope-model': 0, 'scope-variant': 0.75 },
      },
      {
        id: 'auto',
        label: 'Auto',
        ratio: null,
        model_ids: ['scope-model', 'other-model'],
        model_ratios: {},
      },
    ],
    account_model_ids: [],
    account_model_ratios: {},
    account_default_ratio: null,
    models: [
      {
        id: 'scope-model',
        allowlist_match_key: 'scope-family',
        vendor: null,
        supported_endpoint_types: ['openai'],
        availability_status: 'available',
      },
      {
        id: 'scope-variant',
        allowlist_match_key: 'scope-family',
        vendor: null,
        supported_endpoint_types: ['openai-response'],
        availability_status: 'temporary_failure',
      },
      {
        id: 'other-model',
        allowlist_match_key: 'other-model',
        vendor: null,
        supported_endpoint_types: ['anthropic'],
        availability_status: 'available',
      },
      {
        id: 'identity-model',
        allowlist_match_key: 'identity-model',
        vendor: null,
        supported_endpoint_types: ['gemini'],
        availability_status: 'unknown',
      },
      {
        id: 'retired-variant',
        allowlist_match_key: 'scope-family',
        vendor: null,
        supported_endpoint_types: ['openai'],
        availability_status: 'official_unsupported',
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

describe('API key model access state', () => {
  test('blocks submission until model access data is available', () => {
    expect(hasUsableApiKeyModelAccess(undefined)).toBeFalse()
    expect(hasUsableApiKeyModelAccess(buildAccess())).toBeTrue()
  })

  test('previews an ordinary create scope without applying an allowlist', () => {
    const state = getApiKeyModelAccessState(
      buildAccess(),
      'ordinary',
      false,
      []
    )

    expect(state.fixedScope).toBeFalse()
    expect(state.currentAccountScope).toBeFalse()
    expect(state.scope?.label).toBe('Ordinary')
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'scope-model',
      'scope-variant',
    ])
    expect(state.modelRatios).toEqual({
      'scope-model': 0,
      'scope-variant': 0.75,
    })
    expect(state.defaultRatio).toBe(1)
  })

  test('uses fixed account models for PLG-like accounts without exposing a scope', () => {
    const state = getApiKeyModelAccessState(
      buildAccess({
        scope_mode: 'fixed_account',
        groups: [],
        identity_model_ids: [],
        account_model_ids: ['other-model'],
        account_model_ratios: { 'other-model': 0.25 },
        account_default_ratio: 0,
      }),
      'plg',
      false,
      []
    )

    expect(state.fixedScope).toBeTrue()
    expect(state.currentAccountScope).toBeTrue()
    expect(state.scope).toBeNull()
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'other-model',
    ])
    expect(state.modelRatios).toEqual({ 'other-model': 0.25 })
    expect(state.defaultRatio).toBe(0)
  })

  test('uses identity models when a selectable account has no groups', () => {
    const state = getApiKeyModelAccessState(
      buildAccess({ groups: [], create_default_scope: null }),
      '',
      false,
      []
    )

    expect(state.fixedScope).toBeTrue()
    expect(state.currentAccountScope).toBeTrue()
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'identity-model',
    ])
    expect(state.modelRatios).toEqual({ 'identity-model': 0.5 })
    expect(state.defaultRatio).toBe(0)
  })

  test('fails closed for a non-empty unknown group when no groups are selectable', () => {
    const state = getApiKeyModelAccessState(
      buildAccess({ groups: [], create_default_scope: null }),
      'removed-group',
      false,
      []
    )

    expect(state.fixedScope).toBeTrue()
    expect(state.currentAccountScope).toBeFalse()
    expect(state.scope).toBeNull()
    expect(state.scopeModels).toEqual([])
    expect(state.effectiveModels).toEqual([])
    expect(state.modelRatios).toEqual({})
    expect(state.defaultRatio).toBeNull()
  })

  test('uses the current account title for a legacy empty saved group', () => {
    const state = getApiKeyModelAccessState(buildAccess(), '', false, [])

    expect(state.fixedScope).toBeFalse()
    expect(state.currentAccountScope).toBeTrue()
    expect(state.scope).toBeNull()
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'identity-model',
    ])
  })

  test('keeps a non-empty invalid ordinary group unavailable and fail-closed', () => {
    const state = getApiKeyModelAccessState(
      buildAccess(),
      'removed-group',
      false,
      []
    )

    expect(state.currentAccountScope).toBeFalse()
    expect(state.scope).toBeNull()
    expect(state.scopeModels).toEqual([])
    expect(state.effectiveModels).toEqual([])
  })

  test('keeps an edit allowlist disabled without discarding its values', () => {
    const state = getApiKeyModelAccessState(buildAccess(), 'ordinary', false, [
      'other-model',
    ])

    expect(state.effectiveModels).toHaveLength(2)
    expect(state.invalidAllowlistItems).toEqual(['other-model'])
  })

  test('applies an enabled allowlist by the server match key', () => {
    const state = getApiKeyModelAccessState(buildAccess(), 'ordinary', true, [
      'scope-family',
    ])

    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'scope-model',
      'scope-variant',
    ])
    expect(state.modelRatios).toEqual({
      'scope-model': 0,
      'scope-variant': 0.75,
    })
  })

  test('treats an enabled empty allowlist as zero effective models', () => {
    const state = getApiKeyModelAccessState(buildAccess(), 'ordinary', true, [])

    expect(state.scopeModels).toHaveLength(2)
    expect(state.effectiveModels).toEqual([])
    expect(state.modelRatios).toEqual({
      'scope-model': 0,
      'scope-variant': 0.75,
    })
  })

  test('keeps auto ratio context empty instead of falling back to identity', () => {
    const state = getApiKeyModelAccessState(buildAccess(), 'auto', false, [])

    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'scope-model',
      'other-model',
    ])
    expect(state.modelRatios).toEqual({})
    expect(state.defaultRatio).toBeNull()
  })

  test('excludes officially unsupported models from scope totals and allowlists', () => {
    const access = buildAccess()
    const state = getApiKeyModelAccessState(access, 'ordinary', true, [
      'scope-family',
      'retired-model',
    ])

    expect(state.scopeModels.map((model) => model.id)).toEqual([
      'scope-model',
      'scope-variant',
    ])
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'scope-model',
      'scope-variant',
    ])
    expect(state.invalidAllowlistItems).toEqual(['retired-model'])
    expect(getApiKeyModelAllowlistOptions(access.models)).not.toContainEqual({
      label: 'retired-model',
      value: 'retired-model',
    })
  })

  test('preserves and reports allowlist items outside the selected scope', () => {
    const state = getApiKeyModelAccessState(buildAccess(), 'ordinary', true, [
      'scope-family',
      'other-model',
      'removed-model',
      'removed-model',
    ])

    expect(state.invalidAllowlistItems).toEqual([
      'other-model',
      'removed-model',
    ])
    expect(state.effectiveModels.map((model) => model.id)).toEqual([
      'scope-model',
      'scope-variant',
    ])
  })

  test('deduplicates allowlist options that share one server match key', () => {
    expect(getApiKeyModelAllowlistOptions(buildAccess().models)).toEqual([
      { label: 'scope-model', value: 'scope-family' },
      { label: 'other-model', value: 'other-model' },
      { label: 'identity-model', value: 'identity-model' },
    ])
  })
})

describe('API key model preview copy', () => {
  test('describes an ordinary create scope without exposing its group id', () => {
    const access = buildAccess()
    const state = getApiKeyModelAccessState(access, 'ordinary', false, [])
    const copy = getApiKeyModelPreviewCopy(access, state, 'create', false)

    expect(copy.titleKey).toBe('{{group}} available models')
    expect(copy.titleValues).toEqual({ group: 'Ordinary' })
    expect(copy.summaryKey).toBe('Current group supports {{total}} models')
    expect(copy.summaryValues).toEqual({ total: 2 })
    expect(JSON.stringify(copy)).not.toContain('ordinary')
  })

  test('uses fixed-account create wording without exposing PLG', () => {
    const access = buildAccess({
      scope_mode: 'fixed_account',
      groups: [],
      identity_scope: null,
      identity_model_ids: [],
      account_model_ids: ['other-model'],
    })
    const state = getApiKeyModelAccessState(access, 'plg', false, [])
    const copy = getApiKeyModelPreviewCopy(access, state, 'create', false)

    expect(copy.titleKey).toBe('Current account available models')
    expect(copy.summaryKey).toBe(
      'New keys can call the following {{total}} models by default'
    )
    expect(copy.summaryValues).toEqual({ total: 1 })
    expect(copy.drawerTitleKey).toBe('Models available to the new API key')
    expect(JSON.stringify(copy).toLowerCase()).not.toContain('plg')
  })

  test('uses identity-only account wording without exposing identity scope', () => {
    const access = buildAccess({ groups: [], create_default_scope: null })
    const state = getApiKeyModelAccessState(access, '', false, [])
    const copy = getApiKeyModelPreviewCopy(access, state, 'create', false)

    expect(copy.titleKey).toBe('Current account scope')
    expect(copy.summaryKey).toBe(
      'New keys use the current account scope with {{total}} available models'
    )
    expect(copy.summaryValues).toEqual({ total: 1 })
    expect(JSON.stringify(copy)).not.toContain('identity')
  })

  test('distinguishes ordinary edit allowlist off, on, and enabled-empty', () => {
    const access = buildAccess()
    const offState = getApiKeyModelAccessState(access, 'ordinary', false, [])
    const onState = getApiKeyModelAccessState(access, 'ordinary', true, [
      'scope-family',
    ])
    const emptyState = getApiKeyModelAccessState(access, 'ordinary', true, [])

    expect(
      getApiKeyModelPreviewCopy(access, offState, 'edit', false).summaryKey
    ).toBe('All {{total}} models in group')
    expect(
      getApiKeyModelPreviewCopy(access, onState, 'edit', true)
    ).toMatchObject({
      summaryKey: 'Effective {{effective}} / {{total}} in group',
      summaryValues: { effective: 2, total: 2 },
    })
    expect(
      getApiKeyModelPreviewCopy(access, emptyState, 'edit', true)
    ).toMatchObject({
      summaryKey: 'Effective {{effective}} / {{total}} in group',
      summaryValues: { effective: 0, total: 2 },
    })
  })

  test('uses account wording for fixed, identity-only, and legacy edits', () => {
    const fixedAccess = buildAccess({
      scope_mode: 'fixed_account',
      groups: [],
      identity_scope: null,
      identity_model_ids: [],
      account_model_ids: ['other-model'],
    })
    const identityAccess = buildAccess({
      groups: [],
      create_default_scope: null,
    })
    const legacyAccess = buildAccess()
    const cases = [
      [fixedAccess, 'plg'],
      [identityAccess, ''],
      [legacyAccess, ''],
    ] as const

    for (const [access, group] of cases) {
      const offState = getApiKeyModelAccessState(access, group, false, [])
      const onState = getApiKeyModelAccessState(access, group, true, [])
      expect(
        getApiKeyModelPreviewCopy(access, offState, 'edit', false).summaryKey
      ).toBe('All {{total}} models in account')
      expect(
        getApiKeyModelPreviewCopy(access, onState, 'edit', true).summaryKey
      ).toBe('Effective {{effective}} / {{total}} in account')
    }
  })
})
