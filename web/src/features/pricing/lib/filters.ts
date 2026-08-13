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
  SORT_OPTIONS,
  FILTER_ALL,
  FUNCTION_TYPES,
  type FunctionType,
} from '../constants.ts'
import type { PricingModel } from '../types'

const FUNCTION_ENDPOINT_TYPES: Record<
  Exclude<FunctionType, typeof FUNCTION_TYPES.ALL>,
  readonly string[]
> = {
  [FUNCTION_TYPES.CHAT]: [
    'openai',
    'openai-response',
    'openai-response-compact',
    'anthropic',
    'gemini',
  ],
  [FUNCTION_TYPES.IMAGE_GENERATION]: [
    'image-generation',
    'async-image-generation',
  ],
  [FUNCTION_TYPES.VIDEO_GENERATION]: ['openai-video', 'async-video-generation'],
  [FUNCTION_TYPES.EMBEDDINGS]: ['embeddings'],
  [FUNCTION_TYPES.RERANKING]: ['jina-rerank'],
}

const FUNCTION_TAGS: Record<
  Exclude<FunctionType, typeof FUNCTION_TYPES.ALL>,
  readonly string[]
> = {
  [FUNCTION_TYPES.CHAT]: ['chat', 'llm'],
  [FUNCTION_TYPES.IMAGE_GENERATION]: [
    'image',
    'image-generation',
    'image-editing',
  ],
  [FUNCTION_TYPES.VIDEO_GENERATION]: [
    'video',
    'video-generation',
    'video-editing',
  ],
  [FUNCTION_TYPES.EMBEDDINGS]: [
    'embedding',
    'embeddings',
    'text-embedding',
    'text-embeddings',
  ],
  [FUNCTION_TYPES.RERANKING]: ['rerank', 'reranking'],
}

const SPECIALIZED_FUNCTION_TYPES = [
  FUNCTION_TYPES.IMAGE_GENERATION,
  FUNCTION_TYPES.VIDEO_GENERATION,
  FUNCTION_TYPES.EMBEDDINGS,
  FUNCTION_TYPES.RERANKING,
] as const

// ----------------------------------------------------------------------------
// Filter Utilities
// ----------------------------------------------------------------------------

/**
 * Filter models by search query
 */
export function filterBySearch(
  models: PricingModel[],
  query: string
): PricingModel[] {
  if (!query) return models

  const lowerQuery = query.toLowerCase()
  return models.filter(
    (m) =>
      m.model_name?.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.tags?.toLowerCase().includes(lowerQuery) ||
      m.vendor_name?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Filter models by vendor
 */
export function filterByVendor(
  models: PricingModel[],
  vendor: string
): PricingModel[] {
  if (vendor === FILTER_ALL) return models
  return models.filter((m) => m.vendor_name === vendor)
}

/** Check whether a model exposes a user-facing function category. */
export function modelSupportsFunction(
  model: PricingModel,
  functionType: string
): boolean {
  if (functionType === FUNCTION_TYPES.ALL) return true
  if (!(functionType in FUNCTION_ENDPOINT_TYPES)) return false

  const selectedFunction = functionType as Exclude<
    FunctionType,
    typeof FUNCTION_TYPES.ALL
  >
  const supportedEndpoints = new Set(
    (model.supported_endpoint_types ?? []).map((endpoint) =>
      endpoint.toLowerCase()
    )
  )
  const tags = new Set(parseTags(model.tags).map((tag) => tag.toLowerCase()))
  const endpointMatches = FUNCTION_ENDPOINT_TYPES[selectedFunction].some(
    (endpointType) => supportedEndpoints.has(endpointType)
  )
  const tagMatches = FUNCTION_TAGS[selectedFunction].some((tag) =>
    tags.has(tag)
  )

  if (selectedFunction !== FUNCTION_TYPES.CHAT) {
    return tagMatches || endpointMatches
  }
  if (tagMatches) return true

  const hasSpecializedFunction = SPECIALIZED_FUNCTION_TYPES.some(
    (specializedFunction) =>
      FUNCTION_ENDPOINT_TYPES[specializedFunction].some((endpointType) =>
        supportedEndpoints.has(endpointType)
      ) || FUNCTION_TAGS[specializedFunction].some((tag) => tags.has(tag))
  )

  return endpointMatches && !hasSpecializedFunction
}

/** Filter models by their user-facing function category. */
export function filterByFunction(
  models: PricingModel[],
  functionType: string
): PricingModel[] {
  if (functionType === FUNCTION_TYPES.ALL) return models
  return models.filter((model) => modelSupportsFunction(model, functionType))
}

/**
 * Get model price for sorting
 */
function getModelPrice(model: PricingModel): number {
  return model.quota_type === 0 ? model.model_ratio : model.model_price || 0
}

/**
 * Sort models by specified option
 */
export function sortModels(
  models: PricingModel[],
  sortBy: string
): PricingModel[] {
  const sorted = [...models]

  switch (sortBy) {
    case SORT_OPTIONS.NAME:
      sorted.sort((a, b) =>
        (a.model_name || '').localeCompare(b.model_name || '')
      )
      break
    case SORT_OPTIONS.PRICE_LOW:
      sorted.sort((a, b) => getModelPrice(a) - getModelPrice(b))
      break
    case SORT_OPTIONS.PRICE_HIGH:
      sorted.sort((a, b) => getModelPrice(b) - getModelPrice(a))
      break
  }

  return sorted
}

/**
 * Apply all filters and sorting to models
 */
export function filterAndSortModels(
  models: PricingModel[],
  filters: {
    search: string
    vendor: string
    functionType: string
    sortBy: string
  }
): PricingModel[] {
  let result = filterBySearch(models, filters.search)
  result = filterByVendor(result, filters.vendor)
  result = filterByFunction(result, filters.functionType)
  result = sortModels(result, filters.sortBy)

  return result
}

/**
 * Parse tags from comma-separated string
 */
export function parseTags(tagsString?: string): string[] {
  if (!tagsString) return []
  return tagsString
    .split(/[,;|\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}
