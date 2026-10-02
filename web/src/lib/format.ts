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
import { isPersianIntlLocale } from '@/i18n/languages'
import dayjs from '@/lib/dayjs'

import {
  formatCurrencyFromUSD,
  formatQuotaWithCurrency,
  getCurrencyDisplay,
  getCurrencyFractionDigits,
} from './currency'

// ============================================================================
// Number Formatting
// ============================================================================

export function formatNumber(
  value: number | null | undefined,
  locales?: Intl.LocalesArgument
): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(locales, { maximumFractionDigits: 2 }).format(
    value as number
  )
}

/**
 * Format a number with a fixed count of fraction digits and no grouping, in
 * the given locale. Rounds exactly like `Number.prototype.toFixed`, so the
 * digits match `value.toFixed(digits)`; only the digit shapes and the decimal
 * separator follow the locale.
 */
export function formatFixed(
  value: number,
  digits: number,
  locales?: Intl.LocalesArgument
): string {
  return Intl.NumberFormat(locales, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(Number(value.toFixed(digits)))
}

/**
 * Append the percent sign of the locale to a number already formatted in that
 * locale: `%` for most languages, `٪` for Persian. Only the sign follows the
 * locale; it is appended with no space, as the callers wrote it before.
 */
export function appendPercentSign(
  formattedNumber: string,
  locales?: Intl.LocalesArgument
): string {
  const sign = Intl.NumberFormat(locales, { style: 'percent' })
    .formatToParts(0)
    .find((part) => part.type === 'percentSign')?.value
  return `${formattedNumber}${sign ?? '%'}`
}

export function formatCompactNumber(
  value: number | null | undefined,
  locales?: Intl.LocalesArgument
): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(locales, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value as number)
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value as number)) return '-'
  return Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format((value as number) / 100)
}

export function formatCurrencyUSD(value: number | null | undefined): string {
  return formatCurrencyFromUSD(value == null ? null : (value as number))
}

// ============================================================================
// Quota Formatting (500,000 units = $1)
// ============================================================================

/**
 * Format quota into the configured display amount.
 * Quota is stored in units where `quotaPerUnit` equals 1 USD.
 * Pass the interface locale (see `toIntlLocale`) so digits follow the
 * selected language instead of the browser default.
 */
export function formatQuota(
  quota: number,
  locale?: Intl.LocalesArgument
): string {
  return formatQuotaWithCurrency(quota, {
    digitsLarge: 2,
    digitsSmall: 4,
    abbreviate: true,
    locale,
  })
}

/**
 * Parse quota from the current display input back to quota units.
 */
export function parseQuotaFromDollars(amount: number): number {
  if (!Number.isFinite(amount)) return 0

  const { config, meta } = getCurrencyDisplay()

  // Tokens-only or raw quota mode
  if (meta.kind === 'tokens') {
    return Math.round(amount)
  }

  const exchangeRate =
    meta.kind === 'currency' || meta.kind === 'custom' ? meta.exchangeRate : 1

  const usdAmount = exchangeRate > 0 ? amount / exchangeRate : amount

  return Math.round(usdAmount * config.quotaPerUnit)
}

/**
 * Convert quota units to the configured display amount.
 * Reverse of parseQuotaFromDollars.
 */
export function quotaUnitsToDollars(units: number): number {
  const { config, meta } = getCurrencyDisplay()
  return quotaUnitsToDisplayAmount(units, config.quotaPerUnit, meta)
}

function quotaUnitsToDisplayAmount(
  units: number,
  quotaPerUnit: number,
  meta: ReturnType<typeof getCurrencyDisplay>['meta']
): number {
  if (meta.kind === 'tokens') {
    return units
  }

  return (units / quotaPerUnit) * meta.exchangeRate
}

/**
 * Convert quota units to a plain number suitable for an editable input.
 * Uses the same precision as quota list formatting without symbols or suffixes.
 */
export function quotaUnitsToEditableAmount(units: number): number {
  const { config, meta } = getCurrencyDisplay()
  const amount = quotaUnitsToDisplayAmount(units, config.quotaPerUnit, meta)

  if (meta.kind === 'tokens') {
    return Math.round(amount)
  }

  return Number(amount.toFixed(getCurrencyFractionDigits(amount)))
}

/** Return the input step matching the configured editable quota precision. */
export function getEditableQuotaStep(): number {
  const { meta } = getCurrencyDisplay()
  if (meta.kind === 'tokens') {
    return 1
  }

  return 10 ** -getCurrencyFractionDigits(0)
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

const DISPLAY_DATE_TOKENS = /YYYY|MM|DD|HH|mm|ss/g

/**
 * Format a date for display with a Day.js pattern built from the tokens
 * YYYY, MM, DD, HH, mm and ss.
 *
 * Pass the interface locale (see `toIntlLocale`). For a Persian locale the
 * fields come from the Solar Hijri calendar, with `/` between date fields,
 * 24-hour time, and digits that follow the locale (`PERSIAN_INTL_LOCALE`).
 * Any other locale, or no locale, returns `dayjs(value).format(pattern)`
 * unchanged.
 *
 * Display only: values sent to the API, input values, exports and copied
 * text stay Gregorian.
 */
export function formatDisplayDate(
  value: Date | number,
  pattern: string,
  locale?: string
): string {
  if (!isPersianIntlLocale(locale)) return dayjs(value).format(pattern)

  const formatter = new Intl.DateTimeFormat(locale, {
    calendar: 'persian',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = new Map(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  )
  const fields: Record<string, string | undefined> = {
    YYYY: parts.get('year'),
    MM: parts.get('month'),
    DD: parts.get('day'),
    HH: parts.get('hour'),
    mm: parts.get('minute'),
    ss: parts.get('second'),
  }
  return pattern
    .replaceAll(/(YYYY|MM)-(?=MM|DD)/g, '$1/')
    .replaceAll(DISPLAY_DATE_TOKENS, (token) => fields[token] ?? token)
}

/**
 * The Gregorian `YYYY-MM-DD HH:mm:ss` text of a timestamp when the display
 * locale is Persian, for a `title` next to a Solar Hijri date so it can be
 * matched with invoices and server logs. `undefined` for other locales,
 * whose displayed date is already Gregorian.
 */
export function formatGregorianTitle(
  timestamp: number | undefined,
  locale?: string,
  unit: 'seconds' | 'milliseconds' = 'seconds'
): string | undefined {
  if (!isPersianIntlLocale(locale) || !timestamp || timestamp === -1) {
    return undefined
  }
  return formatTimestampToDate(timestamp, unit)
}

/**
 * Format Unix timestamp (seconds) to YYYY-MM-DD HH:mm:ss
 * (Solar Hijri for a Persian locale, see `formatDisplayDate`)
 */
export function formatTimestamp(timestamp: number, locale?: string): string {
  if (timestamp === -1) {
    return 'Never'
  }
  return formatTimestampToDate(timestamp, 'seconds', locale)
}

/**
 * Format timestamp to YYYY-MM-DD HH:mm:ss
 * (Solar Hijri for a Persian locale, see `formatDisplayDate`)
 * @param timestamp - Timestamp in seconds or milliseconds
 * @param unit - Unit of the timestamp ('seconds' or 'milliseconds')
 * @param locale - Interface locale from `toIntlLocale`
 */
export function formatTimestampToDate(
  timestamp?: number,
  unit: 'seconds' | 'milliseconds' = 'seconds',
  locale?: string
): string {
  if (!timestamp || timestamp === -1 || timestamp === 0) {
    return '-'
  }
  const ms = unit === 'seconds' ? timestamp * 1000 : timestamp
  return formatDisplayDate(ms, 'YYYY-MM-DD HH:mm:ss', locale)
}

/**
 * Format timestamp as relative time, e.g. "30 seconds ago".
 * @param timestamp - Timestamp in seconds or milliseconds
 * @param unit - Unit of the timestamp ('seconds' or 'milliseconds')
 * @param locales - Locale passed to Intl.RelativeTimeFormat
 */
export function formatTimestampRelative(
  timestamp?: number,
  unit: 'seconds' | 'milliseconds' = 'seconds',
  locales?: Intl.LocalesArgument
): string {
  if (!timestamp || timestamp === -1 || timestamp === 0) {
    return '-'
  }

  const ms = unit === 'seconds' ? timestamp * 1000 : timestamp
  const diffSeconds = Math.round((ms - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const formatter = new Intl.RelativeTimeFormat(locales, {
    numeric: 'always',
  })

  if (absSeconds < 60) {
    return formatter.format(diffSeconds, 'second')
  }
  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffSeconds / 60), 'minute')
  }
  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffSeconds / 3600), 'hour')
  }
  if (absSeconds < 2592000) {
    return formatter.format(Math.round(diffSeconds / 86400), 'day')
  }
  if (absSeconds < 31536000) {
    return formatter.format(Math.round(diffSeconds / 2592000), 'month')
  }
  return formatter.format(Math.round(diffSeconds / 31536000), 'year')
}

/**
 * Relative time for display, such as "a few seconds ago". Pass the interface
 * locale (see `toIntlLocale`): Persian uses `formatTimestampRelative`
 * (Intl.RelativeTimeFormat); other locales keep the Day.js `fromNow` text.
 */
export function formatFromNow(value: Date | number, locale?: string): string {
  if (!isPersianIntlLocale(locale)) return dayjs(value).fromNow()
  return formatTimestampRelative(
    value instanceof Date ? value.getTime() : value,
    'milliseconds',
    locale
  )
}

/** Format a Date object to YYYY-MM-DD HH:mm:ss (see `formatDisplayDate`) */
export function formatDateTimeStr(date: Date, locale?: string): string {
  return formatDisplayDate(date, 'YYYY-MM-DD HH:mm:ss', locale)
}

/** Format a Date object to YYYY-MM-DD (see `formatDisplayDate`) */
export function formatDateStr(date: Date, locale?: string): string {
  return formatDisplayDate(date, 'YYYY-MM-DD', locale)
}

/** Format a Date object to HH:mm:ss (see `formatDisplayDate`) */
export function formatTimeStr(date: Date, locale?: string): string {
  return formatDisplayDate(date, 'HH:mm:ss', locale)
}

/**
 * Format quota for usage logs with higher precision
 * Uses 6 decimal places to show very small costs accurately
 * Pass the interface locale (see `toIntlLocale`) so digits follow the
 * selected language instead of the browser default.
 */
export function formatLogQuota(
  quota: number,
  locale?: Intl.LocalesArgument
): string {
  return formatQuotaWithCurrency(quota, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
    locale,
  })
}

/**
 * Format tokens count with K/M suffixes
 */
export function formatTokens(tokens: number): string {
  if (tokens === 0) return '-'
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(2)}M`
}

/**
 * Format use time in seconds with appropriate unit
 */
export function formatUseTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`
}

/**
 * Format timestamp to date input value (YYYY-MM-DDTHH:mm)
 */
export function formatTimestampForInput(timestamp: number): string {
  if (timestamp === -1) {
    return ''
  }
  return dayjs(timestamp * 1000).format('YYYY-MM-DDTHH:mm')
}

/**
 * Parse datetime-local input to Unix timestamp
 */
export function parseTimestampFromInput(value: string): number {
  if (!value) {
    return -1
  }
  const date = new Date(value)
  return Math.floor(date.getTime() / 1000)
}

// ============================================================================
// Color Generation
// ============================================================================

/**
 * Generate a consistent color from a string
 * Uses HSL for better color distribution
 */
export function stringToColor(str: string): string {
  if (!str) return 'gray'

  // Generate hash from string
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  // Use hash to generate hue (0-360)
  const hue = Math.abs(hash % 360)

  // Use saturation and lightness that work well for tags
  const saturation = 65 + (Math.abs(hash) % 10) // 65-75%
  const lightness = 55 + (Math.abs(hash >> 8) % 10) // 55-65%

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}
