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
/**
 * Display and payment currencies of the HisarWeb AI pages (TRY, EUR, USD).
 *
 * The balance itself is always kept in USD. A currency only changes how an
 * amount is shown and what a top-up is charged in. The server decides which
 * currencies are on sale and at which rate (`hw_currencies`, `hw_rates`,
 * `hw_topup` in `GET /api/status`); an older server sends none of them and the
 * pages then stay on TRY, exactly as before.
 */

export type HwCurrency = 'TRY' | 'EUR' | 'USD'

export const HW_CURRENCIES: readonly HwCurrency[] = ['TRY', 'EUR', 'USD']

/** localStorage key of the visitor's chosen currency. */
export const HW_CURRENCY_STORAGE_KEY = 'hw-currency'

/** Narrow symbols shown on the currency switch. */
export const HW_CURRENCY_SYMBOLS: Record<HwCurrency, string> = {
  TRY: '₺',
  EUR: '€',
  USD: '$',
}

/**
 * The 20 % KDV factor that only the server's TRY prices contain
 * (`hwKdvFactor` in `service/hw_pricing.go`). EUR and USD prices have none.
 */
export const HW_KDV_FACTOR = 1.2

/** Free start bonus and first-purchase discount cap, both defined in TRY. */
export const HW_BONUS_TRY = 250
export const HW_FIRST_PURCHASE_CAP_TRY = 1000

/**
 * TRY per USD used only to word "about 5 dollars" amounts when the server did
 * not send a TRY rate. Prices never use it.
 */
const HW_FALLBACK_TRY_PER_USD = 50

/** Whole-unit limits and presets of one currency's top-up form. */
export type HwTopUpLimits = {
  min: number
  max: number
  presets: number[]
}

export type HwRates = Partial<Record<HwCurrency, number>>

export type HwCurrencyConfig = {
  /** Currencies on sale, in the order the switch shows them. */
  currencies: HwCurrency[]
  /** Units of currency per 1 USD. USD is always 1. */
  rates: HwRates
  topUp: Partial<Record<HwCurrency, HwTopUpLimits>>
}

/** Bounds of the TRY list value; mirror `HwMinTopUpTry` / `HwMaxTopUpTry`. */
export const HW_TOPUP_MIN_TRY = 100
export const HW_TOPUP_MAX_TRY = 20000
export const HW_TOPUP_PRESET_TRY = [250, 500, 1000, 2000, 5000]

export const HW_LEGACY_TRY_TOPUP: HwTopUpLimits = {
  min: HW_TOPUP_MIN_TRY,
  max: HW_TOPUP_MAX_TRY,
  presets: HW_TOPUP_PRESET_TRY,
}

/** What an older server (no multi-currency fields) means: TRY only. */
export const HW_LEGACY_CURRENCY_CONFIG: HwCurrencyConfig = {
  currencies: ['TRY'],
  rates: {},
  topUp: { TRY: HW_LEGACY_TRY_TOPUP },
}

export function isHwCurrency(value: unknown): value is HwCurrency {
  return typeof value === 'string' && HW_CURRENCIES.includes(value as HwCurrency)
}

/**
 * The currency saved in a user's profile (`hw_currency` inside the `setting`
 * JSON the user endpoints return, as a string or already parsed), or null.
 */
export function readHwProfileCurrency(setting: unknown): HwCurrency | null {
  let parsed: unknown = setting
  if (typeof setting === 'string') {
    try {
      parsed = JSON.parse(setting)
    } catch {
      return null
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const value = (parsed as Record<string, unknown>).hw_currency
  return isHwCurrency(value) ? value : null
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function parseTopUpLimits(value: unknown): HwTopUpLimits | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  const min = positiveNumber(raw.min)
  const max = positiveNumber(raw.max)
  if (min === null || max === null || min > max) return null
  const presets = Array.isArray(raw.presets)
    ? raw.presets
        .map(positiveNumber)
        .filter((p): p is number => p !== null && p >= min && p <= max)
    : []
  return { min, max, presets }
}

/**
 * Reads the three multi-currency fields of `/api/status`. A currency is only
 * kept when the server also gave its rate and top-up limits, so the pages never
 * offer a currency they could not convert or charge. Nothing usable (an older
 * server) gives the TRY-only legacy config.
 */
export function parseHwCurrencyConfig(status: unknown): HwCurrencyConfig {
  if (typeof status !== 'object' || status === null) {
    return HW_LEGACY_CURRENCY_CONFIG
  }
  const raw = status as Record<string, unknown>
  if (!Array.isArray(raw.hw_currencies)) return HW_LEGACY_CURRENCY_CONFIG

  const ratesRaw =
    typeof raw.hw_rates === 'object' && raw.hw_rates !== null
      ? (raw.hw_rates as Record<string, unknown>)
      : {}
  const topUpRaw =
    typeof raw.hw_topup === 'object' && raw.hw_topup !== null
      ? (raw.hw_topup as Record<string, unknown>)
      : {}

  const currencies: HwCurrency[] = []
  const rates: HwRates = {}
  const topUp: HwCurrencyConfig['topUp'] = {}
  for (const code of raw.hw_currencies) {
    if (!isHwCurrency(code) || currencies.includes(code)) continue
    const limits =
      parseTopUpLimits(topUpRaw[code]) ??
      (code === 'TRY' ? HW_LEGACY_TRY_TOPUP : null)
    const rate = code === 'USD' ? 1 : positiveNumber(ratesRaw[code])
    if (!limits || rate === null) continue
    currencies.push(code)
    rates[code] = rate
    topUp[code] = limits
  }
  if (currencies.length === 0) return HW_LEGACY_CURRENCY_CONFIG
  return { currencies, rates, topUp }
}

/** The pieces of the browser that tell where a visitor is. */
export type HwLocaleSignals = {
  languages: readonly string[]
  timeZone?: string
}

const EU_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE',
])

function languageRegion(tag: string): string {
  const parts = tag.split(/[-_]/)
  const region = parts.find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part))
  return region ? region.toUpperCase() : ''
}

export function readHwLocaleSignals(): HwLocaleSignals {
  let languages: readonly string[] = []
  if (typeof navigator !== 'undefined') {
    languages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language].filter(Boolean)
  }
  let timeZone: string | undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timeZone = undefined
  }
  return { languages, timeZone }
}

/**
 * The currency a first-time visitor starts in: TRY for Turkey, EUR for an EU
 * country (region of a browser language, or a Europe/* time zone), USD for the
 * rest. A currency that is not on sale is skipped: TRY, then USD, then the
 * first one the server offers.
 */
export function detectHwDefaultCurrency(
  available: readonly HwCurrency[],
  signals: HwLocaleSignals = readHwLocaleSignals()
): HwCurrency {
  const first = signals.languages[0]?.toLowerCase() ?? ''
  const zone = signals.timeZone ?? ''
  const isTurkey =
    first === 'tr' ||
    first.startsWith('tr-') ||
    languageRegion(first) === 'TR' ||
    zone === 'Europe/Istanbul'
  const isEurope =
    signals.languages.some((tag) => EU_REGIONS.has(languageRegion(tag))) ||
    zone.startsWith('Europe/')

  let wanted: HwCurrency = 'USD'
  if (isTurkey) wanted = 'TRY'
  else if (isEurope) wanted = 'EUR'
  if (available.includes(wanted)) return wanted
  for (const fallback of ['TRY', 'USD'] as const) {
    if (available.includes(fallback)) return fallback
  }
  return available[0] ?? 'TRY'
}

/** The saved choice if it is still on sale, otherwise the detected default. */
export function resolveHwCurrency(
  config: HwCurrencyConfig,
  preferred: HwCurrency | null,
  signals?: HwLocaleSignals
): HwCurrency {
  if (preferred && config.currencies.includes(preferred)) return preferred
  return detectHwDefaultCurrency(config.currencies, signals)
}

/** USD amount in `currency`, or null when that currency has no rate. */
export function convertHwUsd(
  usd: number,
  currency: HwCurrency,
  rates: HwRates
): number | null {
  if (!Number.isFinite(usd)) return null
  if (currency === 'USD') return usd
  const rate = rates[currency]
  if (rate === undefined || !(rate > 0)) return null
  return usd * rate
}

/** A EUR/USD choice of the currency switch, with its rate against the dollar. */
export type HwDisplayOverride = {
  code: Exclude<HwCurrency, 'TRY'>
  symbol: string
  /** Units of `code` per 1 USD. */
  rate: number
}

/**
 * What the console amounts show when the visitor picks EUR or USD on the
 * switch. The console's own display setting (`quota_display_type`, lira on the
 * live site) describes one currency only, so TRY, and a currency without a
 * rate, return null and keep that setting.
 */
export function resolveHwDisplayOverride(
  currency: HwCurrency,
  rates: HwRates
): HwDisplayOverride | null {
  if (currency === 'TRY') return null
  const rate = convertHwUsd(1, currency, rates)
  if (rate === null) return null
  return { code: currency, symbol: HW_CURRENCY_SYMBOLS[currency], rate }
}

/**
 * Rounds an amount down to a tidy number: whole below 20, steps of 5 below
 * 100, 10 below 1000, 50 below 10000 and 500 above. Never below 1.
 */
export function niceFloor(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  let step = 500
  if (value < 20) step = 1
  else if (value < 100) step = 5
  else if (value < 1000) step = 10
  else if (value < 10000) step = 50
  return Math.max(1, Math.floor(value / step) * step)
}

/**
 * A TRY-defined amount (start bonus, discount cap, budget) in whole units of
 * `currency`, rounded down so a text never promises more than the server gives.
 * TRY itself is returned unchanged. The floor allows 1 % of rate noise: 250 TL
 * at 50.03 TL/USD is $4.997, which the balance shows as $5.00, so the text says
 * $5 instead of $4.
 */
export function hwTryAmountIn(
  amountTry: number,
  currency: HwCurrency,
  rates: HwRates
): number {
  if (currency === 'TRY') return amountTry
  const tryPerUsd = rates.TRY ?? HW_FALLBACK_TRY_PER_USD
  const converted = convertHwUsd(amountTry / tryPerUsd, currency, rates)
  return converted === null
    ? amountTry
    : Math.max(1, Math.floor(converted * 1.01))
}
