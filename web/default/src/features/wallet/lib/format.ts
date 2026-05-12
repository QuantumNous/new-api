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
import { DEFAULT_DISCOUNT_RATE } from '../constants'

const DEFAULT_PAYMENT_EXCHANGE_RATE = 7

// ============================================================================
// Wallet-specific Formatting Functions
// ============================================================================

/**
 * Format Creem price with currency symbol (USD/EUR)
 */
export function formatCreemPrice(
  price: number,
  currency: 'USD' | 'EUR'
): string {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${price.toFixed(2)}`
}

/**
 * Format large quota numbers with K/M suffix
 */
export function formatQuotaShort(quota: number): string {
  if (quota >= 1000000) {
    return `${(quota / 1000000).toFixed(1)}M`
  }
  if (quota >= 1000) {
    return `${(quota / 1000).toFixed(1)}K`
  }
  return quota.toString()
}

/**
 * Format currency amount that is already in local currency.
 * This is used for payment amounts that have been calculated via priceRatio.
 */
export function formatCurrency(amount: number | string): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  if (!Number.isFinite(numeric)) return '-'

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(numeric) >= 1 ? 2 : 4,
  }).format(numeric)
}

export function formatWalletCurrencyAmount(
  amount: number | string,
  symbol = '¥'
): string {
  const formatted = formatCurrency(amount)
  return formatted === '-' ? formatted : `${symbol}${formatted}`
}

export function getWalletCurrencyConfig(
  quotaDisplayType?: string,
  usdExchangeRate?: number,
  customCurrencySymbol?: string,
  customCurrencyExchangeRate?: number
) {
  const effectiveUsdExchangeRate =
    usdExchangeRate && usdExchangeRate > 0
      ? usdExchangeRate
      : DEFAULT_PAYMENT_EXCHANGE_RATE

  if (quotaDisplayType === 'USD') {
    return {
      symbol: '$',
      rate: 1,
      paymentSymbol: effectiveUsdExchangeRate === 1 ? '$' : '¥',
      paymentRate: effectiveUsdExchangeRate,
    }
  }

  if (quotaDisplayType === 'CUSTOM') {
    const rate =
      customCurrencyExchangeRate && customCurrencyExchangeRate > 0
        ? customCurrencyExchangeRate
        : 1
    return {
      symbol: customCurrencySymbol?.trim() || '¤',
      rate,
      paymentSymbol: customCurrencySymbol?.trim() || '¤',
      paymentRate: rate,
    }
  }

  return {
    symbol: '¥',
    rate: effectiveUsdExchangeRate,
    paymentSymbol: '¥',
    paymentRate: effectiveUsdExchangeRate,
  }
}

/**
 * Get discount label for display (e.g., "20% OFF")
 */
export function getDiscountLabel(discount: number): string {
  if (discount >= DEFAULT_DISCOUNT_RATE) {
    return ''
  }
  const off = Math.round((1 - discount) * 100)
  return `${off}% OFF`
}

/**
 * Calculate pricing details for a preset amount
 */
export function calculatePresetPricing(
  presetValue: number,
  priceRatio: number,
  discount: number,
  usdExchangeRate: number = 1
) {
  const originalPrice = presetValue * priceRatio
  const actualPrice = originalPrice * discount
  const savedAmount = originalPrice - actualPrice
  const hasDiscount = discount < 1.0
  const displayValue = presetValue * usdExchangeRate

  return {
    displayValue,
    originalPrice,
    actualPrice,
    savedAmount,
    hasDiscount,
  }
}
