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

import { getEndpointTypeLabel } from '@/lib/endpoint-type'

import type { TokenUnit } from './types'

// ----------------------------------------------------------------------------
// Pricing Constants
// ----------------------------------------------------------------------------

/** Sort options for pricing models */
export const SORT_OPTIONS = {
  NAME: 'name',
  INPUT_PRICE_LOW: 'input-price-low',
  INPUT_PRICE_HIGH: 'input-price-high',
  OUTPUT_PRICE_LOW: 'output-price-low',
  OUTPUT_PRICE_HIGH: 'output-price-high',
  REQUEST_PRICE_LOW: 'request-price-low',
  REQUEST_PRICE_HIGH: 'request-price-high',
} as const

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS]

export function getSortLabels(t: TFunction): Record<SortOption, string> {
  return {
    [SORT_OPTIONS.NAME]: t('Name'),
    [SORT_OPTIONS.INPUT_PRICE_LOW]: t('Input Price: Low to High'),
    [SORT_OPTIONS.INPUT_PRICE_HIGH]: t('Input Price: High to Low'),
    [SORT_OPTIONS.OUTPUT_PRICE_LOW]: t('Output Price: Low to High'),
    [SORT_OPTIONS.OUTPUT_PRICE_HIGH]: t('Output Price: High to Low'),
    [SORT_OPTIONS.REQUEST_PRICE_LOW]: t('Per-request Price: Low to High'),
    [SORT_OPTIONS.REQUEST_PRICE_HIGH]: t('Per-request Price: High to Low'),
  }
}

/** Filter values */
export const FILTER_ALL = 'all'

/** Quota type options */
export const QUOTA_TYPES = {
  ALL: 'all',
  TOKEN: 'token',
  REQUEST: 'request',
  TASK: 'task',
} as const

export type QuotaTypeOption = (typeof QUOTA_TYPES)[keyof typeof QUOTA_TYPES]

/** Quota type labels */
export function getQuotaTypeLabels(
  t: TFunction
): Record<QuotaTypeOption, string> {
  return {
    [QUOTA_TYPES.ALL]: t('All Models'),
    [QUOTA_TYPES.TOKEN]: t('Token-based'),
    [QUOTA_TYPES.REQUEST]: t('Per Request'),
    [QUOTA_TYPES.TASK]: t('Task billing'),
  }
}

/** Endpoint type options */
export const ENDPOINT_TYPES = {
  ALL: 'all',
  OPENAI: 'openai',
  OPENAI_RESPONSE: 'openai-response',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  JINA_RERANK: 'jina-rerank',
  IMAGE_GENERATION: 'image-generation',
  EMBEDDINGS: 'embeddings',
  OPENAI_VIDEO: 'openai-video',
  DEEPSEEK_TOOLS_SEARCH: 'deepseek-tools-search',
  DEEPSEEK_TOOLS_FETCH: 'deepseek-tools-fetch',
} as const

export type EndpointTypeOption =
  (typeof ENDPOINT_TYPES)[keyof typeof ENDPOINT_TYPES]

/** Endpoint type labels */
export function getEndpointTypeLabels(
  t: TFunction
): Record<EndpointTypeOption, string> {
  return {
    [ENDPOINT_TYPES.ALL]: t('All Types'),
    [ENDPOINT_TYPES.OPENAI]: getEndpointTypeLabel(ENDPOINT_TYPES.OPENAI, t),
    [ENDPOINT_TYPES.OPENAI_RESPONSE]: getEndpointTypeLabel(
      ENDPOINT_TYPES.OPENAI_RESPONSE,
      t
    ),
    [ENDPOINT_TYPES.ANTHROPIC]: getEndpointTypeLabel(
      ENDPOINT_TYPES.ANTHROPIC,
      t
    ),
    [ENDPOINT_TYPES.GEMINI]: getEndpointTypeLabel(ENDPOINT_TYPES.GEMINI, t),
    [ENDPOINT_TYPES.JINA_RERANK]: getEndpointTypeLabel(
      ENDPOINT_TYPES.JINA_RERANK,
      t
    ),
    [ENDPOINT_TYPES.IMAGE_GENERATION]: getEndpointTypeLabel(
      ENDPOINT_TYPES.IMAGE_GENERATION,
      t
    ),
    [ENDPOINT_TYPES.EMBEDDINGS]: getEndpointTypeLabel(
      ENDPOINT_TYPES.EMBEDDINGS,
      t
    ),
    [ENDPOINT_TYPES.OPENAI_VIDEO]: getEndpointTypeLabel(
      ENDPOINT_TYPES.OPENAI_VIDEO,
      t
    ),
    [ENDPOINT_TYPES.DEEPSEEK_TOOLS_SEARCH]: getEndpointTypeLabel(
      ENDPOINT_TYPES.DEEPSEEK_TOOLS_SEARCH,
      t
    ),
    [ENDPOINT_TYPES.DEEPSEEK_TOOLS_FETCH]: getEndpointTypeLabel(
      ENDPOINT_TYPES.DEEPSEEK_TOOLS_FETCH,
      t
    ),
  }
}

/** Filter section keys */
export const FILTER_SECTIONS = {
  PRICING_TYPE: 'pricingType',
  ENDPOINT_TYPE: 'endpointType',
  VENDOR: 'vendor',
  GROUP: 'group',
  TAG: 'tag',
} as const

/** Maximum number of tags to display in model row */
export const MAX_TAGS_DISPLAY = 5

/** Maximum number of filter items to display before showing "More..." */
export const MAX_FILTER_ITEMS = 5

/** Sidebar width */
export const SIDEBAR_WIDTH = 'w-64'

/** Excluded groups */
export const EXCLUDED_GROUPS = ['', 'auto']

/** Quota type values */
export const QUOTA_TYPE_VALUES = {
  TOKEN: 0,
  REQUEST: 1,
} as const

/** Token unit divisors */
export const TOKEN_UNIT_DIVISORS = {
  M: 1,
  K: 1000,
} as const

/** Default token unit for pricing display */
export const DEFAULT_TOKEN_UNIT: TokenUnit = 'M'

/** View mode options */
export const VIEW_MODES = {
  CARD: 'card',
  TABLE: 'table',
} as const

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES]

/** Default page size for pricing table */
export const DEFAULT_PRICING_PAGE_SIZE = 20
