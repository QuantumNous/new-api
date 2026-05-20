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
  formatCurrencyFromUSD,
  type CurrencyFormatOptions,
} from '@/lib/currency'
import { formatLogQuota, formatQuota } from '@/lib/format'

/** Display-only: normalize currency strings to RMB presentation for ops center UI. */
export function normalizeBillingDisplayString(value: string): string {
  if (!value) return value
  return value
    .replace(/\$/g, '¥')
    .replace(/\bUSD\b/gi, 'CNY')
    .replace(/美元/g, '人民币')
    .replace(/\bdollars?\b/gi, '人民币')
}

export function formatQuotaForOpsCenter(quota: number): string {
  return normalizeBillingDisplayString(formatQuota(quota))
}

export function formatLogQuotaForOpsCenter(quota: number): string {
  return normalizeBillingDisplayString(formatLogQuota(quota))
}

/**
 * Usage-logs detail dialog: show raw quota units as 词元额度/消耗 (never as RMB or USD).
 * Display-only; does not change quota math or global formatQuotaWithCurrency.
 */
export function formatUsageLogQuotaDisplay(
  quota: number | null | undefined,
  options?: { digitsLarge?: number; digitsSmall?: number }
): string {
  if (quota == null || Number.isNaN(quota)) return '-'

  const abs = Math.abs(quota)
  const digitsLarge = options?.digitsLarge ?? 4
  const digitsSmall = options?.digitsSmall ?? 6
  const digits = abs >= 1 ? digitsLarge : digitsSmall

  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(quota)

  return normalizeBillingDisplayString(formatted)
}

export function formatBillingAmountForOpsCenter(
  amountUSD: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  return normalizeBillingDisplayString(
    formatBillingCurrencyFromUSD(amountUSD, options)
  )
}

export function formatWalletAmountForOpsCenter(
  amountUSD: number | null | undefined,
  options?: CurrencyFormatOptions
): string {
  return normalizeBillingDisplayString(
    formatCurrencyFromUSD(amountUSD, options)
  )
}

/** Payment amounts already in local currency (post priceRatio); prefix ¥ when no symbol present. */
export function formatWalletPaymentAmount(amount: number | string): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  if (!Number.isFinite(numeric)) return '-'

  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(numeric) >= 1 ? 2 : 4,
  }).format(numeric)

  if (/[¥￥]/.test(formatted)) {
    return formatted
  }
  return `¥${formatted}`
}

export function formatCreemPriceForOpsCenter(
  price: number,
  currency: 'USD' | 'EUR'
): string {
  if (currency === 'EUR') {
    return `€${price.toFixed(2)}`
  }
  return `¥${price.toFixed(2)}`
}

export function getOpsCenterCurrencyLabel(): string {
  return 'CNY'
}

export function getOpsCenterCurrencyLabelZh(): string {
  return '人民币'
}

/** Subscription plan price_amount display (stored as decimal amount). */
export function formatSubscriptionPriceDisplay(amount: number | string): string {
  const numeric =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount))
  if (!Number.isFinite(numeric)) return '-'
  return formatWalletPaymentAmount(numeric)
}
