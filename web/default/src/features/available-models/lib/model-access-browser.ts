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
import type { ModelAvailabilityStatus } from '@/lib/model-availability'
import type { ModelAccessModel, UserModelAccess } from '../types'
import {
  getAccountModels,
  getScopeModels,
  getUnavailableAccountModels,
  getUnavailableScopeModels,
  isCallableModel,
  resolveCreateScope,
} from './model-access'

export const ALL_MODEL_VENDORS = 'all'
export const UNLABELLED_MODEL_VENDOR = 'unlabelled'

export type ModelVendorFilter = string

export type ModelVendorFilterOption = {
  label: string | null
  value: ModelVendorFilter
}

export type ModelVendorFilterState = {
  filterSignature: string
  scopeKey: string | null
  value: ModelVendorFilter
}

export function getModelEndpointLabel(endpoint: string, t: TFunction): string {
  if (endpoint === 'openai-video') return t('Video')
  if (endpoint.startsWith('openai')) return t('OpenAI Compatible')
  if (endpoint === 'anthropic') return t('Anthropic Compatible')
  if (endpoint === 'gemini') return t('Gemini Compatible')
  if (endpoint === 'image-generation') return t('Image Generation')
  return endpoint
}

export function getCreateKeySearch(scopeId?: string | null): {
  open: 'create'
  group?: string
} {
  return scopeId ? { open: 'create', group: scopeId } : { open: 'create' }
}

export function isFixedModelAccessView(access: UserModelAccess): boolean {
  return access.scope_mode === 'fixed_account' || access.groups.length === 0
}

export function resolveModelAccessScope(
  access: UserModelAccess,
  currentScope?: string | null
): string | null {
  if (isFixedModelAccessView(access)) return null
  if (
    currentScope &&
    access.groups.some((scope) => scope.id === currentScope)
  ) {
    return currentScope
  }
  return resolveCreateScope(access) ?? access.groups[0]?.id ?? null
}

export function getModelAccessScopeModels(
  access: UserModelAccess,
  scopeId?: string | null
): ModelAccessModel[] {
  if (isFixedModelAccessView(access)) return getAccountModels(access)
  return getScopeModels(access, scopeId)
}

export function getModelAccessUnavailableScopeModels(
  access: UserModelAccess,
  scopeId?: string | null
): ModelAccessModel[] {
  if (isFixedModelAccessView(access)) {
    return getUnavailableAccountModels(access)
  }
  return getUnavailableScopeModels(access, scopeId)
}

export function getModelAccessScopeModelCounts(
  access: UserModelAccess
): Map<string, number> {
  const callableModelIds = new Set(
    access.models.filter(isCallableModel).map((model) => model.id)
  )

  return new Map(
    access.groups.map((scope) => [
      scope.id,
      scope.model_ids.reduce(
        (count, modelId) => count + Number(callableModelIds.has(modelId)),
        0
      ),
    ])
  )
}

function modelVendorFilterValue(model: ModelAccessModel): ModelVendorFilter {
  const name = model.vendor?.name.trim()
  return name ? `vendor:${name.toLocaleLowerCase()}` : UNLABELLED_MODEL_VENDOR
}

export function getModelVendorFilters(
  models: readonly ModelAccessModel[]
): ModelVendorFilterOption[] {
  const vendors = new Map<ModelVendorFilter, string>()
  let hasUnlabelled = false

  for (const model of models) {
    const value = modelVendorFilterValue(model)
    if (value === UNLABELLED_MODEL_VENDOR) {
      hasUnlabelled = true
      continue
    }
    if (!vendors.has(value)) {
      vendors.set(value, model.vendor?.name.trim() ?? '')
    }
  }

  const options: ModelVendorFilterOption[] = Array.from(
    vendors,
    ([value, label]) => ({ value, label })
  )
    .filter((option) => option.label)
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))

  if (hasUnlabelled) {
    options.push({ value: UNLABELLED_MODEL_VENDOR, label: null })
  }

  return [{ value: ALL_MODEL_VENDORS, label: null }, ...options]
}

export function getModelVendorFilterSignature(
  filterOptions: readonly ModelVendorFilterOption[]
): string {
  return filterOptions.map((option) => option.value).join('\u0000')
}

export function resolveModelVendorSelection(
  filterOptions: readonly ModelVendorFilterOption[],
  selection: ModelVendorFilter
): ModelVendorFilter {
  return filterOptions.some((option) => option.value === selection)
    ? selection
    : ALL_MODEL_VENDORS
}

/**
 * Model count behind each vendor filter, keyed the same way as the filter
 * options — so vendor spelling variants collapse into one entry, matching how
 * {@link getModelVendorFilters} dedupes them.
 */
export function getModelVendorFilterCounts(
  models: readonly ModelAccessModel[]
): Map<ModelVendorFilter, number> {
  const counts = new Map<ModelVendorFilter, number>([
    [ALL_MODEL_VENDORS, models.length],
  ])
  for (const model of models) {
    const value = modelVendorFilterValue(model)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

export function createModelVendorFilterState(
  filterOptions: readonly ModelVendorFilterOption[],
  scopeKey: string | null,
  value: ModelVendorFilter = ALL_MODEL_VENDORS
): ModelVendorFilterState {
  return {
    filterSignature: getModelVendorFilterSignature(filterOptions),
    scopeKey,
    value: resolveModelVendorSelection(filterOptions, value),
  }
}

export function reconcileModelVendorFilterState(
  filterOptions: readonly ModelVendorFilterOption[],
  scopeKey: string | null,
  state: ModelVendorFilterState
): ModelVendorFilterState {
  const filterSignature = getModelVendorFilterSignature(filterOptions)
  const selectedVendor = resolveModelVendorSelection(filterOptions, state.value)
  const value =
    state.scopeKey === scopeKey && selectedVendor === state.value
      ? state.value
      : ALL_MODEL_VENDORS

  if (
    state.filterSignature === filterSignature &&
    state.scopeKey === scopeKey &&
    state.value === value
  ) {
    return state
  }

  return { filterSignature, scopeKey, value }
}

function matchesVendor(
  model: ModelAccessModel,
  vendor: ModelVendorFilter
): boolean {
  return (
    vendor === ALL_MODEL_VENDORS || modelVendorFilterValue(model) === vendor
  )
}

export function normalizeModelAvailabilityStatus(
  status: ModelAccessModel['availability_status']
): ModelAvailabilityStatus {
  return status === 'unknown' ? 'unknown_failure' : status
}

export function filterModelAccessModels(
  models: readonly ModelAccessModel[],
  query: string,
  vendor: ModelVendorFilter
): ModelAccessModel[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return models.filter((model) => {
    if (!matchesVendor(model, vendor)) return false
    if (!normalizedQuery) return true
    return [model.id, model.description ?? '', model.vendor?.name ?? ''].some(
      (value) => value.toLocaleLowerCase().includes(normalizedQuery)
    )
  })
}
