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
import {
  getAccountModels,
  getEffectiveTokenModels,
  getScopeModels,
  isCallableModel,
  resolveModelRatioContext,
  type ModelAccessModel,
  type ModelAccessScope,
  type UserModelAccess,
} from '@/features/available-models'
import { isCurrentAccountModelScope } from './api-key-model-scope'

export type ApiKeyModelAllowlistOption = {
  label: string
  value: string
}

export type ApiKeyModelAccessState = {
  currentAccountScope: boolean
  effectiveModels: ModelAccessModel[]
  defaultRatio: number | null
  fixedScope: boolean
  invalidAllowlistItems: string[]
  scope: ModelAccessScope | null
  scopeModels: ModelAccessModel[]
  modelRatios: Readonly<Record<string, number>>
}

export type ApiKeyModelPreviewCopy = {
  drawerDescriptionKey: string
  drawerTitleKey: string
  emptyDescriptionKey: string
  emptyTitleKey: string
  summaryKey: string
  summaryValues: Record<string, number>
  titleKey: string
  titleValues?: Record<string, string>
}

export type ApiKeyModelPreviewMode = 'create' | 'edit'

export function hasUsableApiKeyModelAccess(
  access: UserModelAccess | undefined
): access is UserModelAccess {
  return access !== undefined
}

function getUniqueAllowlistItems(modelLimits: readonly string[]): string[] {
  return Array.from(new Set(modelLimits.filter(Boolean)))
}

export function getApiKeyModelAllowlistOptions(
  models: readonly ModelAccessModel[]
): ApiKeyModelAllowlistOption[] {
  const options = new Map<string, ApiKeyModelAllowlistOption>()
  for (const model of models) {
    if (!isCallableModel(model)) continue
    if (!options.has(model.allowlist_match_key)) {
      options.set(model.allowlist_match_key, {
        label: model.id,
        value: model.allowlist_match_key,
      })
    }
  }
  return Array.from(options.values())
}

export function getApiKeyModelAccessState(
  access: UserModelAccess,
  group: string | null | undefined,
  modelLimitsEnabled: boolean,
  modelLimits: readonly string[]
): ApiKeyModelAccessState {
  const fixedScope =
    access.scope_mode === 'fixed_account' || access.groups.length === 0
  const currentAccountScope = isCurrentAccountModelScope(access, group)
  const scope = fixedScope
    ? null
    : (access.groups.find((candidate) => candidate.id === group) ?? null)
  const scopeModels =
    access.scope_mode === 'fixed_account'
      ? getAccountModels(access)
      : getScopeModels(access, group)
  const allowedMatchKeys = new Set(
    scopeModels.map((model) => model.allowlist_match_key)
  )
  const normalizedModelLimits = getUniqueAllowlistItems(modelLimits)
  const invalidAllowlistItems = normalizedModelLimits.filter(
    (item) => !allowedMatchKeys.has(item)
  )
  const effectiveModels = getEffectiveTokenModels(access, {
    group: access.scope_mode === 'fixed_account' ? null : group,
    model_limits_enabled: modelLimitsEnabled,
    model_limits: normalizedModelLimits,
  })
  const ratioContext = resolveModelRatioContext(access, group)

  return {
    currentAccountScope,
    defaultRatio: ratioContext.defaultRatio,
    effectiveModels,
    fixedScope,
    invalidAllowlistItems,
    scope,
    scopeModels,
    modelRatios: ratioContext.modelRatios,
  }
}

export function getApiKeyModelPreviewCopy(
  access: UserModelAccess,
  state: ApiKeyModelAccessState,
  mode: ApiKeyModelPreviewMode,
  modelLimitsEnabled: boolean
): ApiKeyModelPreviewCopy {
  const total = state.scopeModels.length
  const effective = state.effectiveModels.length
  const isAccountScope = state.currentAccountScope
  const isFixedAccount = access.scope_mode === 'fixed_account'
  let titleKey = 'Unavailable scope'
  if (isFixedAccount) {
    titleKey = 'Current account available models'
  } else if (isAccountScope) {
    titleKey = 'Current account scope'
  } else if (state.scope) {
    titleKey = '{{group}} available models'
  }
  const titleValues = state.scope ? { group: state.scope.label } : undefined

  if (mode === 'create') {
    let summaryKey = 'Current group supports {{total}} models'
    if (isFixedAccount) {
      summaryKey = 'New keys can call the following {{total}} models by default'
    } else if (isAccountScope) {
      summaryKey =
        'New keys use the current account scope with {{total}} available models'
    }

    return {
      drawerDescriptionKey:
        'This preview shows the models the new API key can call with the current settings.',
      drawerTitleKey: 'Models available to the new API key',
      emptyDescriptionKey: 'Review the new API key and model access settings.',
      emptyTitleKey: 'No models available to the new API key',
      summaryKey,
      summaryValues: { total },
      titleKey,
      titleValues,
    }
  }

  let summaryKey = 'All {{total}} models in group'
  if (isAccountScope && modelLimitsEnabled) {
    summaryKey = 'Effective {{effective}} / {{total}} in account'
  } else if (isAccountScope) {
    summaryKey = 'All {{total}} models in account'
  } else if (modelLimitsEnabled) {
    summaryKey = 'Effective {{effective}} / {{total}} in group'
  }

  return {
    drawerDescriptionKey:
      'This preview follows the current API key and model access settings.',
    drawerTitleKey: 'Models available to this API key',
    emptyDescriptionKey: 'Review the API key and model access settings.',
    emptyTitleKey: 'No models available to this API key',
    summaryKey,
    summaryValues: { effective, total },
    titleKey,
    titleValues,
  }
}
