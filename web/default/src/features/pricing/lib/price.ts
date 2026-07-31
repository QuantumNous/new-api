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
import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { getConfiguredGroupRatio, getDisplayGroupRatio } from './model-helpers'

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
  const cleanNumber = number.replaceAll(',', '')

  // Convert to number and back to remove trailing zeros
  const parsed = Number.parseFloat(cleanNumber)
  if (Number.isNaN(parsed)) return formatted

  // Convert to string, which automatically removes trailing zeros
  let result = parsed.toString()

  // If the result is in scientific notation, format it properly
  if (result.includes('e')) {
    result = parsed.toFixed(20).replace(/\.?0+$/, '')
  }

  return `${symbol}${result}${suffix}`
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
  ratio: number
): number {
  const base = model.model_ratio * 2 * ratio

  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * model.completion_ratio
    case 'cache':
      return hasRatio(model.cache_ratio)
        ? base * Number(model.cache_ratio)
        : Number.NaN
    case 'create_cache':
      return hasRatio(model.create_cache_ratio)
        ? base * Number(model.create_cache_ratio)
        : Number.NaN
    case 'image':
      return hasRatio(model.image_ratio)
        ? base * Number(model.image_ratio)
        : Number.NaN
    case 'audio_input':
      return hasRatio(model.audio_ratio)
        ? base * Number(model.audio_ratio)
        : Number.NaN
    case 'audio_output':
      return hasRatio(model.audio_ratio) &&
        hasRatio(model.audio_completion_ratio)
        ? base *
            Number(model.audio_ratio) *
            Number(model.audio_completion_ratio)
        : Number.NaN
  }
}

function hasRatio(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

function convertUSDForDisplay(
  amountInUSD: number,
  showInCny: boolean,
  billingUSDToCNYRate: number
): number {
  const rate =
    billingUSDToCNYRate > 0 && Number.isFinite(billingUSDToCNYRate)
      ? billingUSDToCNYRate
      : 1
  return showInCny ? amountInUSD * rate : amountInUSD
}

/** Format a model-catalog amount that has already been converted for display. */
export function formatPricingCurrency(
  amount: number,
  showInCny: boolean,
  digitsLarge = 4,
  digitsSmall = 6
): string {
  if (!Number.isFinite(amount)) return '-'

  const digits = Math.abs(amount) >= 1 ? digitsLarge : digitsSmall
  const number = amount.toFixed(digits).replace(/\.?0+$/, '')
  return `${showInCny ? '¥' : '$'}${number}`
}

/**
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showInCny = false,
  _priceRate = 1,
  billingUSDToCNYRate = 1,
  selectedGroup?: string
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  const priceInUSD = calculateTokenPrice(model, type, displayGroupRatio)
  const price = convertUSDForDisplay(
    priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit],
    showInCny,
    billingUSDToCNYRate
  )
  return formatPricingCurrency(price, showInCny)
}

/**
 * Format the catalog base price before any group multiplier is applied.
 *
 * Official USD list prices use the configured billing exchange rate and no
 * group multiplier.
 */
export function formatOfficialPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  billingUSDToCNYRate = 1
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const priceInUSD = calculateTokenPrice(model, type, 1)
  const priceInCNY = convertUSDForDisplay(
    priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit],
    true,
    billingUSDToCNYRate
  )
  return formatPricingCurrency(priceInCNY, true)
}

/**
 * Format price for a specific group (token-based)
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: PriceType,
  tokenUnit: TokenUnit,
  showInCny = false,
  _priceRate = 1,
  billingUSDToCNYRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  const priceInUSD = calculateTokenPrice(model, type, ratio)
  const price = convertUSDForDisplay(
    priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit],
    showInCny,
    billingUSDToCNYRate
  )
  return formatPricingCurrency(price, showInCny)
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showInCny = false,
  _priceRate = 1,
  billingUSDToCNYRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  const priceInUSD = (model.model_price || 0) * ratio
  const price = convertUSDForDisplay(priceInUSD, showInCny, billingUSDToCNYRate)
  return formatPricingCurrency(price, showInCny, 4, 4)
}

/**
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showInCny = false,
  _priceRate = 1,
  billingUSDToCNYRate = 1,
  selectedGroup?: string
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  const priceInUSD = (model.model_price || 0) * displayGroupRatio
  const price = convertUSDForDisplay(priceInUSD, showInCny, billingUSDToCNYRate)
  return formatPricingCurrency(price, showInCny, 4, 4)
}

/** Format the catalog base request price in CNY at the billing rate. */
export function formatOfficialRequestPrice(
  model: PricingModel,
  billingUSDToCNYRate = 1
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const priceInCNY = convertUSDForDisplay(
    model.model_price || 0,
    true,
    billingUSDToCNYRate
  )
  return formatPricingCurrency(priceInCNY, true, 4, 4)
}
