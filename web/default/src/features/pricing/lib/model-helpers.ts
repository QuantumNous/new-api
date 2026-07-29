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
  usableGroup: Record<string, string | { desc: string; ratio: number }>
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
 * Group models by vendor for Apilio-style Model Hub card sections.
 * Unknown vendors collapse into a single "Other" bucket at the end.
 *
 * Preferred marketplace order (OpenAI / Gemini / DeepSeek / Kimi first;
 * Anthropic later). Unlisted named vendors keep first-seen order after
 * preferred ones; Anthropic is forced after the preferred block; Other last.
 */
export type VendorModelGroup = {
  key: string
  name: string
  icon?: string
  models: PricingModel[]
}

/** Lower rank = earlier section. Matched case-insensitively on vendor name. */
const PREFERRED_VENDOR_RANK: Array<{ match: RegExp; rank: number }> = [
  { match: /^openai$/i, rank: 10 },
  { match: /^(google|gemini)/i, rank: 20 },
  { match: /^deepseek/i, rank: 30 },
  { match: /^(moonshot|kimi)/i, rank: 40 },
  { match: /^(xai|grok)/i, rank: 50 },
  { match: /^(zhipu|智谱|glm)/i, rank: 60 },
  // Anthropic deliberately after the main block
  { match: /^(anthropic|claude)/i, rank: 80 },
]

const DEFAULT_NAMED_VENDOR_RANK = 70
const OTHER_VENDOR_RANK = 1000

function vendorSectionRank(name: string, isOther: boolean): number {
  if (isOther) return OTHER_VENDOR_RANK
  for (const entry of PREFERRED_VENDOR_RANK) {
    if (entry.match.test(name.trim())) {
      return entry.rank
    }
  }
  return DEFAULT_NAMED_VENDOR_RANK
}

export function groupModelsByVendor(
  models: PricingModel[],
  otherLabel = 'Other'
): VendorModelGroup[] {
  const groups = new Map<string, VendorModelGroup>()
  const order: string[] = []

  for (const model of models) {
    const name = model.vendor_name?.trim() || otherLabel
    const key = model.vendor_name?.trim()
      ? `vendor:${name}`
      : `other:${otherLabel}`
    const existing = groups.get(key)
    if (existing) {
      existing.models.push(model)
      if (!existing.icon && model.vendor_icon) {
        existing.icon = model.vendor_icon
      }
      continue
    }
    groups.set(key, {
      key,
      name,
      icon: model.vendor_icon,
      models: [model],
    })
    order.push(key)
  }

  const firstSeen = new Map(order.map((key, index) => [key, index]))

  return [...groups.values()].sort((a, b) => {
    const aOther = a.key.startsWith('other:')
    const bOther = b.key.startsWith('other:')
    const rankA = vendorSectionRank(a.name, aOther)
    const rankB = vendorSectionRank(b.name, bOther)
    if (rankA !== rankB) return rankA - rankB
    return (firstSeen.get(a.key) ?? 0) - (firstSeen.get(b.key) ?? 0)
  })
}

/**
 * Group-ratio discount for a *selected* billing group only.
 *
 * Only returns a percent when a concrete group filter is active, the model
 * lists that group in `enable_groups`, and that group's configured ratio is
 * in (0, 1). Does not fall back to min-of-all-groups or “vs official MSRP”.
 */
export function getGroupSavingsPercent(
  model: PricingModel,
  selectedGroup?: string
): number | null {
  if (!selectedGroup || selectedGroup === FILTER_ALL) return null
  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  if (!enableGroups.includes(selectedGroup)) return null
  // Use the configured ratio for this group only (no min-across-groups fallback).
  const ratio = getConfiguredGroupRatio(model.group_ratio || {}, selectedGroup)
  if (!(ratio > 0) || !(ratio < 1)) return null
  const percent = Math.round((1 - ratio) * 100)
  if (percent < 1) return null
  return Math.min(percent, 99)
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
