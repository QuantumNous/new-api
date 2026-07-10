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
import { EXCLUDED_GROUPS, FILTER_ALL, QUOTA_TYPE_VALUES } from '../constants'
import type { PricingModel } from '../types'

// ----------------------------------------------------------------------------
// Model Helper Utilities
// ----------------------------------------------------------------------------

/**
 * Get available groups for a model
 */
export function getAvailableGroups(
  model: PricingModel,
  usableGroup: Record<string, { desc: string; ratio: number }>
): string[] {
  const modelEnableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []

  return Object.keys(usableGroup)
    .filter((g) => !EXCLUDED_GROUPS.includes(g))
    .filter((g) => modelEnableGroups.includes(g))
}

/**
 * Read a configured group ratio while preserving valid zero ratios.
 */
export function getConfiguredGroupRatio(
  groupRatio: Record<string, number>,
  group: string
): number {
  const ratio = groupRatio[group]
  return typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : 1
}

/**
 * Resolve the group ratio used by model square summary prices.
 *
 * When no specific group is selected, the model square shows the best price
 * available to the viewer. When a group filter is active, it mirrors classic
 * and shows that group's price.
 */
export function getDisplayGroupRatio(
  model: PricingModel,
  selectedGroup?: string
): number {
  const modelEnableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}

  if (
    selectedGroup &&
    selectedGroup !== FILTER_ALL &&
    modelEnableGroups.includes(selectedGroup)
  ) {
    return getConfiguredGroupRatio(groupRatio, selectedGroup)
  }

  if (modelEnableGroups.length === 0) {
    return 1
  }

  let minRatio = Number.POSITIVE_INFINITY

  for (const group of modelEnableGroups) {
    const ratio = groupRatio[group]
    if (
      typeof ratio === 'number' &&
      Number.isFinite(ratio) &&
      ratio < minRatio
    ) {
      minRatio = ratio
    }
  }

  return minRatio === Number.POSITIVE_INFINITY ? 1 : minRatio
}

/**
 * Replace model placeholder in endpoint path
 */
export function replaceModelInPath(path: string, modelName: string): string {
  return path.replaceAll('{model}', modelName)
}

/**
 * Check if model is token-based pricing
 */
export function isTokenBasedModel(model: PricingModel): boolean {
  return model.quota_type === QUOTA_TYPE_VALUES.TOKEN
}

type ImagePerSizePrices = NonNullable<PricingModel['image_per_size_prices']>

export type ImageSummaryPriceEntry = {
  label: '1K' | '2K' | '4K'
  key: 'price_1k' | 'price_2k' | 'price_4k'
  matrixKey: '1k_medium' | '2k_medium' | '4k_medium'
  value: number
}

const IMAGE_SUMMARY_PRICE_TIERS = [
  {
    label: '1K',
    key: 'price_1k',
    matrixKey: '1k_medium',
  },
  {
    label: '2K',
    key: 'price_2k',
    matrixKey: '2k_medium',
  },
  {
    label: '4K',
    key: 'price_4k',
    matrixKey: '4k_medium',
  },
] as const

function getImageSummaryPriceValue(
  prices: ImagePerSizePrices,
  tier: (typeof IMAGE_SUMMARY_PRICE_TIERS)[number]
): number {
  const matrix = prices.price_matrix ?? {}
  const matrixValue = matrix[tier.matrixKey]
  if (Number.isFinite(matrixValue)) return matrixValue

  const legacyValue = prices[tier.key]
  if (Number.isFinite(legacyValue)) return legacyValue

  const defaultValue = matrix.default
  return Number.isFinite(defaultValue) ? defaultValue : 0
}

/**
 * Size-only summary used by cards and group tables.
 * When a quality matrix exists, use the medium quality row so summaries match
 * the detailed matrix instead of stale legacy price_1k/2k/4k values.
 */
export function getImageSummaryPriceEntries(
  prices: ImagePerSizePrices
): ImageSummaryPriceEntry[] {
  return IMAGE_SUMMARY_PRICE_TIERS.map((tier) => ({
    ...tier,
    value: getImageSummaryPriceValue(prices, tier),
  }))
}

/** Preferred display order for video resolution price tiers. */
export const VIDEO_RESOLUTION_ORDER = [
  '480p',
  '720p',
  '1080p',
  '4k',
  'default',
] as const

/**
 * Return video price matrix entries in preferred resolution order.
 * Only includes keys present in the matrix (does not invent missing tiers).
 */
export function getOrderedVideoPriceEntries(
  matrix: Record<string, number>
): Array<[string, number]> {
  const preferredSet = new Set<string>(VIDEO_RESOLUTION_ORDER)
  const preferred = VIDEO_RESOLUTION_ORDER.filter(
    (key) => matrix[key] != null && Number.isFinite(matrix[key])
  ).map((key) => [key, matrix[key]] as [string, number])
  const rest = Object.entries(matrix)
    .filter(([key, value]) => !preferredSet.has(key) && Number.isFinite(value))
    .sort(([a], [b]) => a.localeCompare(b))
  return [...preferred, ...rest]
}

/**
 * True when model uses per-second video billing.
 * Primary signal is video_billing_mode from the API; matrix may be empty
 * (still show the per-second badge / empty-tier message, never fall back to tokens).
 */
export function isVideoPerSecondModel(model: PricingModel): boolean {
  return model.video_billing_mode === 'per_second'
}

/**
 * Safe price matrix for a per-second video model (empty object when unset).
 */
export function getVideoPriceMatrix(
  model: PricingModel
): Record<string, number> {
  return model.video_per_second_prices?.price_matrix ?? {}
}
