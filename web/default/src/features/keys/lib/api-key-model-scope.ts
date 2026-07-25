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
  resolveModelRatioContext,
  type ModelAccessModel,
  type UserModelAccess,
} from '@/features/available-models'
import type { ApiKey } from '../types'

export type ApiKeyModelScopeSummary = {
  defaultRatio: number | null
  effectiveModels: ModelAccessModel[]
  totalModels: ModelAccessModel[]
  labelKind: 'all-group' | 'all-account' | 'limited' | 'empty'
  modelRatios: Readonly<Record<string, number>>
}

export function isCurrentAccountModelScope(
  access: UserModelAccess,
  group: string | null | undefined
): boolean {
  return access.scope_mode === 'fixed_account' || !group
}

export function shouldShowApiKeyGroupColumn(
  access: UserModelAccess | undefined,
  canUseGroups: boolean
): boolean {
  return (
    canUseGroups &&
    access?.scope_mode === 'selectable_group' &&
    access.groups.length > 0
  )
}

export function getApiKeyCallableModels(
  access: UserModelAccess | undefined,
  apiKey: ApiKey | null
): ModelAccessModel[] {
  if (!access || !apiKey) return []
  const currentAccountScope = isCurrentAccountModelScope(access, apiKey.group)
  return getEffectiveTokenModels(access, {
    ...apiKey,
    group: currentAccountScope ? null : apiKey.group,
  })
}

export function getApiKeyModelScopeSummary(
  access: UserModelAccess,
  apiKey: ApiKey
): ApiKeyModelScopeSummary {
  const currentAccountScope = isCurrentAccountModelScope(access, apiKey.group)
  const totalModels = currentAccountScope
    ? getAccountModels(access)
    : getScopeModels(access, apiKey.group)
  const effectiveModels = getApiKeyCallableModels(access, apiKey)
  const ratioContext = resolveModelRatioContext(access, apiKey.group)

  if (effectiveModels.length === 0) {
    return {
      defaultRatio: ratioContext.defaultRatio,
      effectiveModels,
      totalModels,
      labelKind: 'empty',
      modelRatios: ratioContext.modelRatios,
    }
  }

  if (apiKey.model_limits_enabled) {
    return {
      defaultRatio: ratioContext.defaultRatio,
      effectiveModels,
      totalModels,
      labelKind: 'limited',
      modelRatios: ratioContext.modelRatios,
    }
  }

  return {
    defaultRatio: ratioContext.defaultRatio,
    effectiveModels,
    totalModels,
    labelKind: currentAccountScope ? 'all-account' : 'all-group',
    modelRatios: ratioContext.modelRatios,
  }
}
