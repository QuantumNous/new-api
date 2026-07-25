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
import type { UserModelAccess } from '../types'
import { resolveModelRatioContext } from './model-access'
import {
  ALL_MODEL_VENDORS,
  createModelVendorFilterState,
  filterModelAccessModels,
  getCreateKeySearch,
  getModelEndpointLabel,
  getModelAccessScopeModelCounts,
  getModelAccessScopeModels,
  getModelAccessUnavailableScopeModels,
  getModelVendorFilterSignature,
  getModelVendorFilters,
  isFixedModelAccessView,
  normalizeModelAvailabilityStatus,
  reconcileModelVendorFilterState,
  resolveModelAccessScope,
  resolveModelVendorSelection,
  UNLABELLED_MODEL_VENDOR,
} from './model-access-browser'

function buildAccess(
  overrides: Partial<UserModelAccess> = {}
): UserModelAccess {
  return {
    scope_mode: 'selectable_group',
    identity_scope: 'identity',
    identity_model_ids: ['identity-model'],
    identity_model_ratios: {},
    identity_default_ratio: 1,
    create_default_scope: 'auto',
    groups: [
      {
        id: 'auto',
        label: 'Auto',
        ratio: null,
        model_ids: ['gpt-main', 'image-main'],
        model_ratios: {},
      },
      {
        id: 'standard',
        label: 'Standard',
        ratio: 1,
        model_ids: ['gpt-main'],
        model_ratios: { 'gpt-main': 0.7 },
      },
    ],
    account_model_ids: [],
    account_model_ratios: {},
    account_default_ratio: null,
    models: [
      {
        id: 'gpt-main',
        allowlist_match_key: 'gpt-main',
        vendor: { id: 1, name: 'OpenAI' },
        supported_endpoint_types: ['openai', 'anthropic'],
        availability_status: 'temporary_failure',
      },
      {
        id: 'identity-model',
        allowlist_match_key: 'identity-model',
        vendor: null,
        supported_endpoint_types: ['gemini'],
        availability_status: 'unknown',
      },
      {
        id: 'image-main',
        allowlist_match_key: 'image-main',
        vendor: { id: 2, name: 'Example Labs' },
        supported_endpoint_types: ['image-generation'],
        availability_status: 'available',
      },
    ],
    ...overrides,
  }
}

describe('available models browser scope selection', () => {
  test('builds exact selectable and fixed-account create-key deep links', () => {
    expect(getCreateKeySearch('standard')).toEqual({
      open: 'create',
      group: 'standard',
    })
    expect(getCreateKeySearch(null)).toEqual({ open: 'create' })
  })

  test('prefers a valid current scope, then the create default', () => {
    const access = buildAccess()

    expect(resolveModelAccessScope(access, 'standard')).toBe('standard')
    expect(resolveModelAccessScope(access, 'removed')).toBe('auto')
  })

  test('uses identity models without exposing a selector when groups are empty', () => {
    const access = buildAccess({ groups: [], create_default_scope: null })

    expect(isFixedModelAccessView(access)).toBe(true)
    expect(resolveModelAccessScope(access, 'identity')).toBeNull()
    expect(getModelAccessScopeModels(access).map((model) => model.id)).toEqual([
      'identity-model',
    ])
  })

  test('keeps identity ratios when an identity-only account uses the fixed layout', () => {
    const access = buildAccess({
      groups: [],
      create_default_scope: null,
      identity_model_ratios: { 'identity-model': 0.5 },
      identity_default_ratio: 0,
      account_model_ratios: { 'identity-model': 9 },
      account_default_ratio: 9,
    })
    const activeScopeId = resolveModelAccessScope(access, null)

    expect(isFixedModelAccessView(access)).toBe(true)
    expect(
      getModelAccessScopeModels(access, activeScopeId).map((model) => model.id)
    ).toEqual(['identity-model'])
    expect(resolveModelRatioContext(access, activeScopeId)).toEqual({
      modelRatios: { 'identity-model': 0.5 },
      defaultRatio: 0,
    })
  })

  test('uses account models for fixed accounts regardless of group state', () => {
    const access = buildAccess({
      scope_mode: 'fixed_account',
      identity_scope: null,
      identity_model_ids: [],
      create_default_scope: null,
      groups: [],
      account_model_ids: ['gpt-main'],
    })

    expect(
      getModelAccessScopeModels(access, 'plg').map((model) => model.id)
    ).toEqual(['gpt-main'])
  })

  test('counts callable models for every scope from one shared model index', () => {
    const access = buildAccess({
      groups: [
        {
          id: 'auto',
          label: 'Auto',
          ratio: null,
          model_ids: ['gpt-main', 'image-main', 'retired-main'],
          model_ratios: {},
        },
        {
          id: 'standard',
          label: 'Standard',
          ratio: 1,
          model_ids: ['gpt-main', 'missing-main'],
          model_ratios: {},
        },
      ],
      models: [
        ...buildAccess().models,
        {
          ...buildAccess().models[0],
          id: 'retired-main',
          availability_status: 'official_unsupported',
        },
      ],
    })

    expect(getModelAccessScopeModelCounts(access)).toEqual(
      new Map([
        ['auto', 2],
        ['standard', 1],
      ])
    )
  })
})

describe('available models browser filters', () => {
  const models = buildAccess().models
  const t = ((key: string) => key) as TFunction

  test('matches model IDs and public vendor names case-insensitively', () => {
    expect(
      filterModelAccessModels(models, 'GPT-', 'all').map((model) => model.id)
    ).toEqual(['gpt-main'])
    expect(
      filterModelAccessModels(models, 'example labs', 'all').map(
        (model) => model.id
      )
    ).toEqual(['image-main'])
  })

  test('builds dynamic vendor filters without hardcoding vendors', () => {
    const withMoreVendors = [
      ...models,
      {
        ...models[0],
        id: 'claude-main',
        vendor: { id: 3, name: 'Anthropic' },
      },
      {
        ...models[0],
        id: 'gemini-main',
        vendor: { id: 4, name: 'Google' },
      },
      {
        ...models[0],
        id: 'openai-duplicate',
        vendor: { id: 99, name: 'openai' },
      },
    ]

    expect(getModelVendorFilters(withMoreVendors)).toEqual([
      { value: ALL_MODEL_VENDORS, label: null },
      { value: 'vendor:anthropic', label: 'Anthropic' },
      { value: 'vendor:example labs', label: 'Example Labs' },
      { value: 'vendor:google', label: 'Google' },
      { value: 'vendor:openai', label: 'OpenAI' },
      { value: UNLABELLED_MODEL_VENDOR, label: null },
    ])
  })

  test('preserves valid vendor selections across equivalent option arrays', () => {
    const openAiFilters = getModelVendorFilters([models[0]])
    expect(resolveModelVendorSelection(openAiFilters, 'vendor:openai')).toBe(
      'vendor:openai'
    )

    const equivalentOpenAiFilters = getModelVendorFilters([models[0]])
    expect(getModelVendorFilterSignature(equivalentOpenAiFilters)).toBe(
      getModelVendorFilterSignature(openAiFilters)
    )
    expect(
      resolveModelVendorSelection(equivalentOpenAiFilters, 'vendor:openai')
    ).toBe('vendor:openai')

    const selectedState = createModelVendorFilterState(
      openAiFilters,
      'scope-a',
      'vendor:openai'
    )
    expect(
      reconcileModelVendorFilterState(
        equivalentOpenAiFilters,
        'scope-a',
        selectedState
      )
    ).toBe(selectedState)

    const otherVendorFilters = getModelVendorFilters([models[2]])
    expect(
      resolveModelVendorSelection(otherVendorFilters, 'vendor:openai')
    ).toBe(ALL_MODEL_VENDORS)
  })

  test('permanently resets vendor selection after changing scopes', () => {
    const openAiFilters = getModelVendorFilters([models[0]])
    const otherVendorFilters = getModelVendorFilters([models[2]])
    const selectedState = createModelVendorFilterState(
      openAiFilters,
      'scope-a',
      'vendor:openai'
    )

    const otherScopeState = reconcileModelVendorFilterState(
      otherVendorFilters,
      'scope-b',
      selectedState
    )
    expect(otherScopeState.value).toBe(ALL_MODEL_VENDORS)

    const returnedScopeState = reconcileModelVendorFilterState(
      openAiFilters,
      'scope-a',
      otherScopeState
    )
    expect(returnedScopeState.value).toBe(ALL_MODEL_VENDORS)
  })

  test('rejects vendor selections that are missing from the current options', () => {
    const openAiFilters = getModelVendorFilters([models[0]])

    expect(resolveModelVendorSelection(openAiFilters, 'vendor:missing')).toBe(
      ALL_MODEL_VENDORS
    )
    expect(resolveModelVendorSelection(openAiFilters, ALL_MODEL_VENDORS)).toBe(
      ALL_MODEL_VENDORS
    )
  })

  test('filters by actual vendor metadata and keeps unlabelled models distinct', () => {
    expect(
      filterModelAccessModels(models, '', 'vendor:example labs').map(
        (model) => model.id
      )
    ).toEqual(['image-main'])
    expect(
      filterModelAccessModels(models, '', UNLABELLED_MODEL_VENDOR).map(
        (model) => model.id
      )
    ).toEqual(['identity-model'])
  })

  test('labels compatible endpoints explicitly and deduplicates variants', () => {
    expect(getModelEndpointLabel('openai', t)).toBe('OpenAI Compatible')
    expect(getModelEndpointLabel('openai-response', t)).toBe(
      'OpenAI Compatible'
    )
    expect(getModelEndpointLabel('anthropic', t)).toBe('Anthropic Compatible')
    expect(getModelEndpointLabel('gemini', t)).toBe('Gemini Compatible')
    expect(getModelEndpointLabel('jina-rerank', t)).toBe('jina-rerank')
  })

  test('keeps temporary failures callable while filtering vendors', () => {
    const visible = filterModelAccessModels(models, '', 'vendor:openai')

    expect(visible).toHaveLength(1)
    expect(visible[0]).toMatchObject({
      id: 'gpt-main',
      availability_status: 'temporary_failure',
    })
  })

  test('separates officially unsupported models from the callable scope', () => {
    const base = buildAccess()
    const access = buildAccess({
      groups: base.groups.map((scope) =>
        scope.id === 'standard'
          ? { ...scope, model_ids: ['gpt-main', 'retired-main'] }
          : scope
      ),
      models: [
        ...base.models,
        {
          ...base.models[0],
          id: 'retired-main',
          availability_status: 'official_unsupported',
        },
      ],
    })

    expect(
      getModelAccessScopeModels(access, 'standard').map((model) => model.id)
    ).toEqual(['gpt-main'])
    expect(
      getModelAccessUnavailableScopeModels(access, 'standard').map(
        (model) => model.id
      )
    ).toEqual(['retired-main'])
  })

  test('maps unknown availability to the neutral unknown-failure config', () => {
    expect(normalizeModelAvailabilityStatus('unknown')).toBe('unknown_failure')
    expect(normalizeModelAvailabilityStatus('temporary_failure')).toBe(
      'temporary_failure'
    )
  })
})
