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
export const INTERFACE_LANGUAGE_OPTIONS = [
  { code: 'zhCN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zhTW', label: '繁體中文' },
  { code: 'fa', label: 'فارسی', dir: 'rtl' },
] as const

/**
 * Interface languages whose locale file may be incomplete. A key missing from
 * one of these files falls back to English per key at runtime (i18next
 * `fallbackLng`), and `i18n:sync` does not fill the gaps with English text.
 * All other interface languages stay complete.
 */
export const PARTIAL_INTERFACE_LANGUAGES = ['fa'] as const

/**
 * Intl locale used for Persian. Plain `fa` keeps the Intl default for Persian,
 * which renders Persian digits (۱۲۳). Change it to `fa-u-nu-latn` to render
 * Latin digits (123) everywhere numbers and dates are formatted.
 */
export const PERSIAN_INTL_LOCALE = 'fa'

export type InterfaceLanguageCode =
  (typeof INTERFACE_LANGUAGE_OPTIONS)[number]['code']

export type TextDirection = 'ltr' | 'rtl'

/**
 * Text direction of an interface language. Languages without an explicit
 * `dir` in `INTERFACE_LANGUAGE_OPTIONS` are left-to-right.
 */
export function getInterfaceLanguageDirection(
  value?: string | null
): TextDirection {
  const code = normalizeInterfaceLanguage(value)
  const option: { code: string; dir?: TextDirection } | undefined =
    INTERFACE_LANGUAGE_OPTIONS.find((lang) => lang.code === code)
  return option?.dir ?? 'ltr'
}

export function normalizeInterfaceLanguage(value?: string | null): string {
  if (!value) return 'en'

  let normalized = value.trim().replaceAll('_', '-').toLowerCase()
  if (
    value === 'zh-TW' ||
    value === 'zh-HK' ||
    value === 'zh-MO' ||
    value === 'zhTW'
  ) {
    normalized = 'zhTW'
  }
  if (value === 'zh-CN' || value === 'zh-Hans' || value === 'zhCN') {
    normalized = 'zhCN'
  }
  if (normalized.startsWith('fa-')) {
    normalized = 'fa'
  }

  return INTERFACE_LANGUAGE_OPTIONS.some((lang) => lang.code === normalized)
    ? normalized
    : 'en'
}

/**
 * Map a browser-detected locale onto the interface language codes this project
 * uses with i18next (`zhCN` / `zhTW` / `fa`).
 *
 * Browsers report standard BCP-47 tags (`zh-CN`, `zh-TW`, `zh-Hant`, `zh`, ...),
 * but `supportedLngs`/resources use the non-standard camelCase codes, so without
 * this mapping a Chinese browser would never match and fall back to English.
 * Non-Chinese codes are returned unchanged so i18next's own `supportedLngs`
 * matching still applies (e.g. `fr-FR` -> `fr`, `ja` -> `ja`).
 */
export function convertDetectedLanguage(value: string): string {
  const lower = value.trim().replaceAll('_', '-').toLowerCase()
  if (lower === 'fa' || lower.startsWith('fa-')) return 'fa'
  if (!lower.startsWith('zh')) return value
  if (
    lower === 'zhtw' ||
    lower === 'zh-tw' ||
    lower === 'zh-hk' ||
    lower === 'zh-mo' ||
    lower.startsWith('zh-hant')
  ) {
    return 'zhTW'
  }
  return 'zhCN'
}

/**
 * Join a before and an after value with an arrow that reads in the direction
 * of the interface language (an interface code or an Intl locale).
 * Left-to-right languages get `from → to`, unchanged. Right-to-left languages
 * wrap each value in FSI … PDI, so the bidi algorithm keeps it in one piece,
 * and point the arrow left, so `from ← to` reads from right to left.
 */
export function formatValueChange(
  from: string,
  to: string,
  language?: string | null
): string {
  return formatValueChain([from, to], language)
}

/**
 * Join a sequence of values (a retry chain, for example) with arrows that
 * read in the direction of the interface language, the same way as
 * `formatValueChange`: `a → b → c` left to right, `a ← b ← c` with each value
 * isolated right to left.
 */
export function formatValueChain(
  values: readonly string[],
  language?: string | null
): string {
  if (getInterfaceLanguageDirection(language) === 'ltr') {
    return values.join(' → ')
  }
  return values.map((value) => `\u2068${value}\u2069`).join(' ← ')
}

/**
 * Convert an interface language code (the values i18next uses, such as `zhCN` /
 * `zhTW`) into a valid BCP-47 locale tag that the `Intl.*` APIs accept.
 *
 * `new Intl.NumberFormat('zhCN')` throws `RangeError: Invalid language tag`, so
 * any locale derived from `i18n.language` / `i18n.resolvedLanguage` MUST be run
 * through this before it reaches an `Intl` constructor. Unknown values fall back
 * to `undefined`, which makes `Intl` use the runtime default locale.
 */
export function toIntlLocale(value?: string | null): string | undefined {
  if (!value) return undefined
  switch (value) {
    case 'zhCN':
      return 'zh-CN'
    case 'zhTW':
      return 'zh-TW'
    case 'fa':
      return PERSIAN_INTL_LOCALE
    default:
      break
  }
  try {
    return Intl.getCanonicalLocales(value)[0]
  } catch {
    return undefined
  }
}

/**
 * Whether an Intl locale tag (the result of `toIntlLocale`) is Persian. Dates
 * shown in Persian use the Solar Hijri calendar; see `formatDisplayDate`.
 */
export function isPersianIntlLocale(locale?: string | null): boolean {
  if (!locale) return false
  try {
    return new Intl.Locale(locale).language === 'fa'
  } catch {
    return false
  }
}
