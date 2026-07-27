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
import type { ApiKeyModel, ApiKeyModelEndpoint } from '../api'

export type CCSwitchApp = 'claude' | 'codex' | 'gemini'

export type CCSwitchModelField =
  | 'model'
  | 'haikuModel'
  | 'sonnetModel'
  | 'opusModel'

export type CCSwitchModelGroupKind = 'protocol' | 'gateway' | 'other'

export type CCSwitchModelGroup = {
  kind: CCSwitchModelGroupKind
  models: ApiKeyModel[]
}

const SPECIALIZED_ENDPOINTS = new Set<ApiKeyModelEndpoint>([
  'embeddings',
  'image-generation',
  'jina-rerank',
  'openai-video',
])

const CLAUDE_OWNERS = ['anthropic', 'claude']
const CODEX_OWNERS = ['openai']
const GEMINI_OWNERS = ['gemini', 'google']

function includesEndpoint(
  model: ApiKeyModel,
  endpoint: ApiKeyModelEndpoint
): boolean {
  return model.supportedEndpointTypes.includes(endpoint)
}

function hasAnyEndpoint(
  model: ApiKeyModel,
  endpoints: ApiKeyModelEndpoint[]
): boolean {
  return endpoints.some((endpoint) => includesEndpoint(model, endpoint))
}

function isSpecializedModel(model: ApiKeyModel): boolean {
  return model.supportedEndpointTypes.some((endpoint) =>
    SPECIALIZED_ENDPOINTS.has(endpoint)
  )
}

function isCompactOnlyModel(model: ApiKeyModel): boolean {
  return (
    model.supportedEndpointTypes.length > 0 &&
    model.supportedEndpointTypes.every(
      (endpoint) => endpoint === 'openai-response-compact'
    )
  )
}

function getModelGroupKind(
  model: ApiKeyModel,
  app: CCSwitchApp
): CCSwitchModelGroupKind {
  if (isSpecializedModel(model) || isCompactOnlyModel(model)) return 'other'

  if (app === 'claude') {
    if (includesEndpoint(model, 'anthropic')) return 'protocol'
    if (hasAnyEndpoint(model, ['openai', 'gemini'])) return 'gateway'
    return 'other'
  }

  if (app === 'codex') {
    if (includesEndpoint(model, 'openai-response')) return 'protocol'
    if (hasAnyEndpoint(model, ['openai', 'anthropic', 'gemini'])) {
      return 'gateway'
    }
    return 'other'
  }

  if (includesEndpoint(model, 'gemini')) return 'protocol'
  if (hasAnyEndpoint(model, ['openai', 'anthropic'])) return 'gateway'
  return 'other'
}

function matchesOwner(model: ApiKeyModel, owners: string[]): boolean {
  const owner = model.ownedBy?.toLowerCase() ?? ''
  return owners.some((candidate) => owner.includes(candidate))
}

function matchesAppFamily(model: ApiKeyModel, app: CCSwitchApp): boolean {
  const modelId = model.id.toLowerCase()

  if (app === 'claude') {
    return modelId.includes('claude') || matchesOwner(model, CLAUDE_OWNERS)
  }

  if (app === 'codex') {
    return (
      modelId.startsWith('gpt-') ||
      modelId.startsWith('codex') ||
      /^o[134](?:-|$)/.test(modelId) ||
      matchesOwner(model, CODEX_OWNERS)
    )
  }

  return modelId.includes('gemini') || matchesOwner(model, GEMINI_OWNERS)
}

function matchesFieldFamily(
  model: ApiKeyModel,
  field: CCSwitchModelField
): boolean {
  if (field === 'model') return false
  const family = field.replace('Model', '').toLowerCase()
  return model.id.toLowerCase().includes(family)
}

function getSearchRank(model: ApiKeyModel, search: string): number {
  if (!search) return 0

  const searchableValues = [
    model.id,
    model.ownedBy ?? '',
    ...model.supportedEndpointTypes,
  ].map((value) => value.toLowerCase())

  if (searchableValues.some((value) => value === search)) return 0
  if (searchableValues.some((value) => value.startsWith(search))) return 1
  if (searchableValues.some((value) => value.includes(search))) return 2
  return Number.POSITIVE_INFINITY
}

export function groupCCSwitchModels(
  models: ApiKeyModel[],
  app: CCSwitchApp,
  field: CCSwitchModelField,
  search = ''
): CCSwitchModelGroup[] {
  const normalizedSearch = search.trim().toLowerCase()
  const indexedModels = models.map((model, index) => ({ model, index }))
  const kinds: CCSwitchModelGroupKind[] = ['protocol', 'gateway', 'other']

  return kinds.map((kind) => {
    const groupedModels = indexedModels
      .filter(({ model }) => getModelGroupKind(model, app) === kind)
      .map(({ model, index }) => ({
        appRank: matchesAppFamily(model, app) ? 0 : 1,
        fieldRank: matchesFieldFamily(model, field) ? 0 : 1,
        index,
        model,
        searchRank: getSearchRank(model, normalizedSearch),
      }))
      .filter(({ searchRank }) => Number.isFinite(searchRank))
      .sort((left, right) => {
        if (left.searchRank !== right.searchRank) {
          return left.searchRank - right.searchRank
        }
        if (left.fieldRank !== right.fieldRank) {
          return left.fieldRank - right.fieldRank
        }
        if (left.appRank !== right.appRank) {
          return left.appRank - right.appRank
        }
        return left.index - right.index
      })
      .map(({ model }) => model)

    return { kind, models: groupedModels }
  })
}
