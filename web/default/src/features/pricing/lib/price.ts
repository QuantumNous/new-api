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
import { formatCurrencyFromUSD } from '@/lib/currency'

import {
  FILTER_ALL,
  QUOTA_TYPE_VALUES,
  TOKEN_UNIT_DIVISORS,
} from '../constants'
import type {
  ModelGroupPricingOverride,
  PricingModel,
  TokenUnit,
  PriceType,
} from '../types'
import {
  getModelGroupPricingOverride,
  resolveGroupBillingMode,
} from './group-billing'

// Re-export the group-resolution helpers so existing `from './price'` and
// barrel (`from '../lib'`) importers keep their import paths. group-billing.ts
// is the single source of truth (shared with the dynamic-pricing path), which
// removes the previous duplicate resolveGroupBillingMode definition.
export { resolveGroupBillingMode }

// ----------------------------------------------------------------------------
// Price Calculation Utilities
// ----------------------------------------------------------------------------

/**
 * Strip trailing zeros from formatted price string while preserving currency symbols
 */
export function stripTrailingZeros(formatted: string): string {
  // Match currency symbol at start, number, and potential 'k' suffix
  const match = formatted.match(/^([^\d-]*)([-\d,]+\.?\d*)(k?)$/)
  if (!match) return formatted

  const [, symbol, number, suffix] = match

  // Remove commas for processing
  const cleanNumber = number.replace(/,/g, '')

  // Convert to number and back to remove trailing zeros
  const parsed = parseFloat(cleanNumber)
  if (isNaN(parsed)) return formatted

  // Convert to string, which automatically removes trailing zeros
  let result = parsed.toString()

  // If the result is in scientific notation, format it properly
  if (result.includes('e')) {
    result = parsed.toFixed(20).replace(/\.?0+$/, '')
  }

  return `${symbol}${result}${suffix}`
}

export function getEffectiveGroupRatio(
  model: PricingModel | undefined,
  group: string,
  groupRatio: Record<string, number>
): number {
  const modelPricing = model?.group_pricing?.[group]
  if (typeof modelPricing === 'number' && Number.isFinite(modelPricing)) {
    return modelPricing
  }
  if (
    modelPricing &&
    typeof modelPricing === 'object' &&
    modelPricing.ratio !== undefined &&
    modelPricing.ratio !== null &&
    Number.isFinite(Number(modelPricing.ratio))
  ) {
    return Number(modelPricing.ratio)
  }
  const globalRatio = groupRatio[group]
  if (globalRatio !== undefined && Number.isFinite(Number(globalRatio))) {
    return Number(globalRatio)
  }
  return 1
}

function getPriceOverride(
  model: PricingModel,
  group: string | undefined,
  type: PriceType
): number | undefined {
  if (!group) return undefined
  const override = getModelGroupPricingOverride(model, group)
  if (!override) return undefined
  const keyByType: Record<PriceType, keyof ModelGroupPricingOverride> = {
    input: 'prompt_price',
    output: 'completion_price',
    cache: 'cache_price',
    create_cache: 'create_cache_price',
    image: 'image_price',
    audio_input: 'audio_price',
    audio_output: 'audio_completion_price',
  }
  const value = override[keyByType[type]]
  return value !== undefined && value !== null && Number.isFinite(Number(value))
    ? Number(value)
    : undefined
}

function calculateMinGroupTokenPrice(
  model: PricingModel,
  type: PriceType,
  enableGroups: string[],
  groupRatio: Record<string, number>
): number {
  if (enableGroups.length === 0) {
    return calculateTokenPrice(model, type, 1)
  }
  let minPrice = Number.POSITIVE_INFINITY
  for (const group of enableGroups) {
    // The aggregate (all-groups) card/table shape is per-token here; only
    // compare groups that still resolve to per-token, so a group overridden to
    // per-request/tiered_expr does not pollute the min token price.
    if (resolveGroupBillingMode(model, group) !== 'per-token') continue
    const ratio = getEffectiveGroupRatio(model, group, groupRatio)
    const price = calculateTokenPrice(model, type, ratio, group)
    if (Number.isFinite(price) && price < minPrice) {
      minPrice = price
    }
  }
  // No group resolves to per-token (or none has this price type): fall back to
  // the model default at ratio 1 — same semantics as the empty-groups branch
  // above and as the classic frontend, keeping the two themes symmetric.
  return minPrice === Number.POSITIVE_INFINITY
    ? calculateTokenPrice(model, type, 1)
    : minPrice
}

function calculateMinGroupRequestPrice(
  model: PricingModel,
  enableGroups: string[],
  groupRatio: Record<string, number>
): number {
  if (enableGroups.length === 0) {
    return model.model_price || 0
  }
  let minPrice = Number.POSITIVE_INFINITY
  for (const group of enableGroups) {
    // Mirror of calculateMinGroupTokenPrice: only per-request groups participate
    // in the aggregate per-request min.
    if (resolveGroupBillingMode(model, group) !== 'per-request') continue
    const ratio = getEffectiveGroupRatio(model, group, groupRatio)
    const override = getModelGroupPricingOverride(model, group)
    const price =
      override?.model_price !== undefined &&
      override.model_price !== null &&
      Number.isFinite(Number(override.model_price))
        ? Number(override.model_price)
        : (model.model_price || 0) * ratio
    if (Number.isFinite(price) && price < minPrice) {
      minPrice = price
    }
  }
  return minPrice === Number.POSITIVE_INFINITY
    ? model.model_price || 0
    : minPrice
}

/**
 * Calculate token price in USD.
 *
 * Returns NaN when the required ratio field is missing/null so callers can
 * skip rendering that price type.
 */
function calculateTokenPrice(
  model: PricingModel,
  type: PriceType,
  ratio: number,
  group?: string
): number {
  const override = getPriceOverride(model, group, type)
  if (override !== undefined) {
    return override
  }

  const base = model.model_ratio * 2 * ratio

  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * model.completion_ratio
    case 'cache':
      return hasRatio(model.cache_ratio)
        ? base * Number(model.cache_ratio)
        : NaN
    case 'create_cache':
      return hasRatio(model.create_cache_ratio)
        ? base * Number(model.create_cache_ratio)
        : NaN
    case 'image':
      return hasRatio(model.image_ratio)
        ? base * Number(model.image_ratio)
        : NaN
    case 'audio_input':
      return hasRatio(model.audio_ratio)
        ? base * Number(model.audio_ratio)
        : NaN
    case 'audio_output':
      return hasRatio(model.audio_ratio) &&
        hasRatio(model.audio_completion_ratio)
        ? base *
            Number(model.audio_ratio) *
            Number(model.audio_completion_ratio)
        : NaN
  }
}

function hasRatio(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

/**
 * Apply recharge rate to price
 *
 * priceRate represents how much users need to recharge (in the display currency)
 * to get 1 USD credit. usdExchangeRate is the real exchange rate.
 *
 * The returned value will be formatted by formatCurrencyFromUSD, which will
 * multiply by the display currency's exchange rate.
 *
 * Examples:
 *
 * 1. Display currency = USD:
 *    - Model: 1 USD
 *    - priceRate = 0.5 (recharge $0.5 to get $1 credit)
 *    - usdExchangeRate = 1
 *    - Return: 1 × 0.5 / 1 = 0.5
 *    - formatCurrencyFromUSD(0.5) → $0.5 ✓
 *
 * 2. Display currency = CNY:
 *    - Model: 1 USD
 *    - priceRate = 4 (recharge ¥4 to get $1 credit)
 *    - usdExchangeRate = 7 (real rate: 1 USD = ¥7)
 *    - Return: 1 × 4 / 7 = 0.571
 *    - formatCurrencyFromUSD(0.571) → 0.571 × 7 = ¥4 ✓
 *    - Normal price: ¥7, Recharge price: ¥4 (cheaper!)
 */
function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

/**
 * Format token-based price for display.
 *
 * When `group` is provided (and not the "all" sentinel), the price is computed
 * for that specific group using its effective billing mode; otherwise the
 * minimum across all enabled groups is used.
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  group?: string
): string {
  const specificGroup = group && group !== FILTER_ALL ? group : undefined

  // Respect the group's effective billing mode: a per-request/dynamic group has
  // no token price to show.
  if (specificGroup) {
    if (resolveGroupBillingMode(model, specificGroup) !== 'per-token') {
      return '-'
    }
  } else if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  let priceInUSD: number
  if (specificGroup) {
    const ratio = getEffectiveGroupRatio(model, specificGroup, groupRatio)
    priceInUSD = calculateTokenPrice(model, type, ratio, specificGroup)
  } else {
    priceInUSD = calculateMinGroupTokenPrice(
      model,
      type,
      enableGroups,
      groupRatio
    )
  }
  if (!Number.isFinite(priceInUSD)) {
    return '-'
  }
  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format price for a specific group (token-based)
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (resolveGroupBillingMode(model, group) !== 'per-token') {
    return '-'
  }

  const ratio = getEffectiveGroupRatio(model, group, groupRatio)
  let priceInUSD = calculateTokenPrice(model, type, ratio, group)
  if (!Number.isFinite(priceInUSD)) {
    return '-'
  }

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (resolveGroupBillingMode(model, group) !== 'per-request') {
    return '-'
  }

  const ratio = getEffectiveGroupRatio(model, group, groupRatio)
  const groupOverride = getModelGroupPricingOverride(model, group)
  let priceInUSD =
    groupOverride?.model_price !== undefined &&
    groupOverride.model_price !== null &&
    Number.isFinite(Number(groupOverride.model_price))
      ? Number(groupOverride.model_price)
      : (model.model_price || 0) * ratio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models.
 *
 * When `group` is provided (and not the "all" sentinel), the price is computed
 * for that specific group; otherwise the minimum across all enabled groups is
 * used.
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  group?: string
): string {
  const specificGroup = group && group !== FILTER_ALL ? group : undefined

  if (specificGroup) {
    if (resolveGroupBillingMode(model, specificGroup) !== 'per-request') {
      return '-'
    }
  } else if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  let priceInUSD: number
  if (specificGroup) {
    const ratio = getEffectiveGroupRatio(model, specificGroup, groupRatio)
    const override = getModelGroupPricingOverride(model, specificGroup)
    priceInUSD =
      override?.model_price !== undefined &&
      override.model_price !== null &&
      Number.isFinite(Number(override.model_price))
        ? Number(override.model_price)
        : (model.model_price || 0) * ratio
  } else {
    priceInUSD = calculateMinGroupRequestPrice(model, enableGroups, groupRatio)
  }

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}
