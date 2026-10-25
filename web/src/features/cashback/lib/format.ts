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
import { getCurrencyDisplay } from '@/lib/currency'

/**
 * Exact CNY cents from a checkout rule, never the site's quota/display FX.
 * `wholeYuan` drops `.00` from whole amounts for compact marketing copy.
 */
export function formatCashbackCents(
  cents: number,
  locale?: Intl.LocalesArgument,
  options?: { wholeYuan?: boolean }
): string {
  if (!Number.isSafeInteger(cents)) return '-'
  const yuan = BigInt(cents) / 100n
  if (options?.wholeYuan && cents % 100 === 0) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'CNY',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).format(yuan)
  }
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const fraction = String(Math.abs(cents % 100)).padStart(2, '0')
  return formatter
    .formatToParts(yuan)
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('')
}

/** Render cashback wallet quota in CNY regardless of the site's quota display mode.
 * These are quota equivalents, not attested cash payments or refund amounts.
 */
export function formatCashbackQuota(
  quota: number | null | undefined,
  locale?: Intl.LocalesArgument,
  showSymbol = true
): string {
  if (quota == null || !Number.isFinite(quota)) return '-'
  const { config } = getCurrencyDisplay()
  const amount = (quota / config.quotaPerUnit) * config.usdExchangeRate
  const digitsSmall = Math.min(
    20,
    Math.max(
      4,
      Math.ceil(Math.log10(config.quotaPerUnit / config.usdExchangeRate)) + 2
    )
  )
  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amount) < 1 ? digitsSmall : 2,
  }).format(amount)
}

/** Quota of the top-up face recorded at checkout, or null for legacy orders. */
export function cashbackFaceQuota(
  faceAmount: number | undefined,
  quotaPerFaceUnit: string | undefined
): number | null {
  const factor = Number(quotaPerFaceUnit)
  if (!faceAmount || !Number.isFinite(factor) || factor <= 0) return null
  return faceAmount * factor
}
