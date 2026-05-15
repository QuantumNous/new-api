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
  formatBillingCurrencyFromUSD,
  type CurrencyFormatOptions,
} from '@/lib/currency'
import { getWalletCurrencyConfig } from '@/features/wallet/lib'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit, PriceType } from '../types'

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

/**
 * Find minimum group ratio from enabled groups
 */
function getMinGroupRatio(
  enableGroups: string[],
  groupRatio: Record<string, number>
): number {
  if (enableGroups.length === 0) return 1

  let minRatio = Number.POSITIVE_INFINITY

  for (const group of enableGroups) {
    const ratio = groupRatio[group]
    if (ratio !== undefined && ratio < minRatio) {
      minRatio = ratio
    }
  }

  return minRatio === Number.POSITIVE_INFINITY ? 1 : minRatio
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

const PRICE_FORMAT_OPTIONS: CurrencyFormatOptions = {
  digitsLarge: 4,
  digitsSmall: 6,
  abbreviate: false,
}

const REQUEST_PRICE_FORMAT_OPTIONS: CurrencyFormatOptions = {
  digitsLarge: 4,
  digitsSmall: 4,
  abbreviate: false,
}

const VIDEO_PRICE_FORMAT_OPTIONS: CurrencyFormatOptions = {
  digitsLarge: 4,
  digitsSmall: 4,
  abbreviate: false,
}

function formatPaymentCurrency(
  amount: number,
  options: CurrencyFormatOptions
): string {
  if (Number.isNaN(amount)) return '-'

  const currency = useSystemConfigStore.getState().config.currency
  const walletCurrency = getWalletCurrencyConfig(
    currency.quotaDisplayType,
    currency.usdExchangeRate,
    currency.customCurrencySymbol,
    currency.customCurrencyExchangeRate
  )
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amount) >= 1 ? options.digitsLarge : options.digitsSmall,
  }).format(amount)

  return `${walletCurrency.paymentSymbol}${formatted}`
}

function formatPricingCurrency(
  amountUSD: number,
  showWithRecharge: boolean,
  priceRate: number,
  options: CurrencyFormatOptions
): string {
  if (showWithRecharge) {
    return formatPaymentCurrency(amountUSD * priceRate, options)
  }
  return formatBillingCurrencyFromUSD(amountUSD, options)
}

/**
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  _usdExchangeRate = 1
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  const minRatio = getMinGroupRatio(enableGroups, groupRatio)

  const priceInUSD =
    calculateTokenPrice(model, type, minRatio) / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatPricingCurrency(
    priceInUSD,
    showWithRecharge,
    priceRate,
    PRICE_FORMAT_OPTIONS
  )
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
  _usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  const priceInUSD =
    calculateTokenPrice(model, type, ratio) / TOKEN_UNIT_DIVISORS[tokenUnit]

  return formatPricingCurrency(
    priceInUSD,
    showWithRecharge,
    priceRate,
    PRICE_FORMAT_OPTIONS
  )
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  _usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  const priceInUSD = (model.model_price || 0) * ratio

  return formatPricingCurrency(
    priceInUSD,
    showWithRecharge,
    priceRate,
    REQUEST_PRICE_FORMAT_OPTIONS
  )
}

/**
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  _usdExchangeRate = 1
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  const minRatio = getMinGroupRatio(enableGroups, groupRatio)

  const priceInUSD = (model.model_price || 0) * minRatio

  return formatPricingCurrency(
    priceInUSD,
    showWithRecharge,
    priceRate,
    REQUEST_PRICE_FORMAT_OPTIONS
  )
}

export function getVideoPriceEntries(
  model: PricingModel
): Array<{ resolution: string; price: number }> {
  const prices = model.video_price?.prices || {}
  return Object.entries(prices)
    .map(([resolution, price]) => ({ resolution, price: Number(price) }))
    .filter((entry) => Number.isFinite(entry.price) && entry.price > 0)
    .sort((a, b) => a.price - b.price)
}

export function formatVideoSecondPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  _usdExchangeRate = 1,
  ratio = 1
): string {
  const first = getVideoPriceEntries(model)[0]
  if (!first) return '-'
  return formatPricingCurrency(
    first.price * ratio,
    showWithRecharge,
    priceRate,
    VIDEO_PRICE_FORMAT_OPTIONS
  )
}
