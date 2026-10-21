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

import { formatLocalCurrencyAmount, getCurrencyDisplay } from '@/lib/currency'

import { DEFAULT_DISCOUNT_RATE } from '../constants'

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

/**
 * Get discount label for display (e.g., "20% OFF")
 */
export function getDiscountLabel(discount: number, t: TFunction): string {
  if (discount >= DEFAULT_DISCOUNT_RATE) {
    return ''
  }
  const off = Math.round((1 - discount) * 100)
  return t('{{percent}}% OFF', { percent: off })
}

/**
 * Calculate pricing details for a preset amount
 */
export function calculatePresetPricing(
  presetValue: number,
  priceRatio: number,
  discount: number,
  _usdExchangeRate: number = 1
) {
  const originalPrice = presetValue * priceRatio
  const actualPrice = originalPrice * discount
  const savedAmount = originalPrice - actualPrice
  const hasDiscount = discount < 1.0
  const displayValue = presetValue

  return {
    displayValue,
    originalPrice,
    actualPrice,
    savedAmount,
    hasDiscount,
  }
}

export function formatWalletDisplayAmount(amountUsd: number): string {
  return formatLocalCurrencyAmount(amountUsd, {
    digitsLarge: 2,
    digitsSmall: 2,
    abbreviate: false,
  })
}

export function getPresetAmountDisplay(
  rechargeAmount: number,
  paymentAmount: number
): { primary: string; secondary: string } {
  const { config } = getCurrencyDisplay()
  if (config.quotaDisplayType === 'USD') {
    return {
      primary: formatWalletDisplayAmount(rechargeAmount),
      secondary: `Pay ${formatWalletPaymentAmount(paymentAmount)}`,
    }
  }
  return {
    primary: formatWalletPaymentAmount(paymentAmount),
    secondary: '',
  }
}

export function getPresetTopupAmount(
  rechargeAmount: number,
  paymentAmount: number
): number {
  const { config } = getCurrencyDisplay()
  return config.quotaDisplayType === 'USD' ? rechargeAmount : paymentAmount
}

export function getWalletRechargeCurrencySymbol(): string {
  const { config, meta } = getCurrencyDisplay()
  if (meta.kind === 'custom') return meta.symbol
  if (config.quotaDisplayType === 'CNY') return '¥'
  return '$'
}

export function formatWalletConfirmationTopupAmount(amount: number): string {
  return formatWalletDisplayAmount(amount)
}

export function formatWalletPaymentAmount(amount: number): string {
  if (amount == null || Number.isNaN(amount)) return '-'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amount) >= 1 ? 2 : 4,
  }).format(amount)
}

export function displayAmountToTopupAmount(
  displayAmount: number,
  _usdExchangeRate: number
): number {
  if (!Number.isFinite(displayAmount)) return 0
  return displayAmount
}
