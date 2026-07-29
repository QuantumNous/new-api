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
const SAVINGS_WINDOW_SECONDS = 24 * 60 * 60
const SECONDS_PER_MINUTE = 60
const CNY_MICROS_PER_YUAN = 1_000_000n

export function getRollingSavingsTimeRange(nowMs = Date.now()): {
  start_timestamp: number
  end_timestamp: number
} {
  const endTimestamp =
    Math.floor(nowMs / (SECONDS_PER_MINUTE * 1000)) * SECONDS_PER_MINUTE
  return {
    start_timestamp: endTimestamp - SAVINGS_WINDOW_SECONDS,
    end_timestamp: endTimestamp,
  }
}

export function formatSavingsQuotaAsCNY(
  quota: number,
  quotaPerUnit: number,
  usdExchangeRate: number,
  locales?: Intl.LocalesArgument
): string {
  if (!Number.isFinite(quota)) return '-'

  const amountCNY = savingsQuotaToCNY(quota, quotaPerUnit, usdExchangeRate)

  return new Intl.NumberFormat(locales, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(amountCNY) >= 1 ? 2 : 4,
  }).format(amountCNY)
}

export function savingsQuotaToCNY(
  quota: number,
  quotaPerUnit: number,
  usdExchangeRate: number
): number {
  if (!Number.isFinite(quota)) return 0

  const effectiveQuotaPerUnit =
    Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 500_000
  const effectiveExchangeRate =
    Number.isFinite(usdExchangeRate) && usdExchangeRate > 0
      ? usdExchangeRate
      : 1
  return (quota / effectiveQuotaPerUnit) * effectiveExchangeRate
}

export function formatSavingsCNYMicros(
  value: string,
  locales?: Intl.LocalesArgument
): string {
  if (!/^\d+$/.test(value)) return '-'

  const micros = BigInt(value)
  const whole = micros / CNY_MICROS_PER_YUAN
  const remainder = micros % CNY_MICROS_PER_YUAN
  const maximumFractionDigits = whole > 0n ? 2 : 4
  const fractionScale = 10n ** BigInt(6 - maximumFractionDigits)
  const roundedFraction = (remainder + fractionScale / 2n) / fractionScale
  const fractionBase = 10n ** BigInt(maximumFractionDigits)
  const roundedWhole = whole + roundedFraction / fractionBase
  const normalizedFraction = roundedFraction % fractionBase
  const decimal = `${roundedWhole}.${normalizedFraction
    .toString()
    .padStart(maximumFractionDigits, '0')}`

  const formatter = new Intl.NumberFormat(locales, {
    style: 'currency',
    currency: 'CNY',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
  const parts = formatter.formatToParts(0)
  const groupSeparator =
    formatter.formatToParts(1000).find((part) => part.type === 'group')
      ?.value ?? ','
  const decimalSeparator =
    formatter.formatToParts(0.1).find((part) => part.type === 'decimal')
      ?.value ?? '.'
  const groupedWhole = roundedWhole
    .toString()
    .replaceAll(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)
  const trimmedFraction = decimal.split('.')[1].replace(/0+$/, '')
  const amount = trimmedFraction
    ? `${groupedWhole}${decimalSeparator}${trimmedFraction}`
    : groupedWhole
  return parts
    .map((part) => (part.type === 'integer' ? amount : part.value))
    .join('')
}
