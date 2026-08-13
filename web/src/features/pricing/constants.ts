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

import type { TokenUnit } from './types'

// ----------------------------------------------------------------------------
// Pricing Constants
// ----------------------------------------------------------------------------

/** Sort options for pricing models */
export const SORT_OPTIONS = {
  NAME: 'name',
  PRICE_LOW: 'price-low',
  PRICE_HIGH: 'price-high',
} as const

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS]

export function getSortLabels(t: TFunction): Record<SortOption, string> {
  return {
    [SORT_OPTIONS.NAME]: t('Name'),
    [SORT_OPTIONS.PRICE_LOW]: t('Price: Low to High'),
    [SORT_OPTIONS.PRICE_HIGH]: t('Price: High to Low'),
  }
}

/** Filter values */
export const FILTER_ALL = 'all'

/** User-facing model function categories */
export const FUNCTION_TYPES = {
  ALL: 'all',
  CHAT: 'chat',
  IMAGE_GENERATION: 'image_generation',
  VIDEO_GENERATION: 'video_generation',
  EMBEDDINGS: 'embeddings',
  RERANKING: 'reranking',
} as const

export type FunctionType = (typeof FUNCTION_TYPES)[keyof typeof FUNCTION_TYPES]

export function getFunctionTypeLabels(
  t: TFunction
): Record<FunctionType, string> {
  return {
    [FUNCTION_TYPES.ALL]: t('All Functions'),
    [FUNCTION_TYPES.CHAT]: t('Chat'),
    [FUNCTION_TYPES.IMAGE_GENERATION]: t('Image Generation'),
    [FUNCTION_TYPES.VIDEO_GENERATION]: t('Video Generation'),
    [FUNCTION_TYPES.EMBEDDINGS]: t('Text Embeddings'),
    [FUNCTION_TYPES.RERANKING]: t('Reranking'),
  }
}

/** Maximum number of tags to display in model row */
export const MAX_TAGS_DISPLAY = 5

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
