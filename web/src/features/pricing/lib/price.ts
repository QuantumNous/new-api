import { formatCurrencyFromUSD } from '@/lib/currency'
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
 * Calculate token price in USD
 */
function calculateTokenPrice(
  model: PricingModel,
  type: PriceType,
  ratio: number
): number {
  const inputPrice = model.model_ratio * 2 * ratio
  const outputPrice = model.model_ratio * model.completion_ratio * 2 * ratio
  return type === 'input' ? inputPrice : outputPrice
}

/**
 * Apply recharge rate to price
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
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  const minRatio = getMinGroupRatio(enableGroups, groupRatio)

  let priceInUSD = calculateTokenPrice(model, type, minRatio)
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
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  let priceInUSD = calculateTokenPrice(model, type, ratio)

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
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = groupRatio[group] || 1
  let priceInUSD = (model.model_price || 0) * ratio

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
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const enableGroups = Array.isArray(model.enable_groups)
    ? model.enable_groups
    : []
  const groupRatio = model.group_ratio || {}
  const minRatio = getMinGroupRatio(enableGroups, groupRatio)

  let priceInUSD = (model.model_price || 0) * minRatio

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
