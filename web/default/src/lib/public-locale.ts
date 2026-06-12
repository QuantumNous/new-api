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
  INTERFACE_LANGUAGE_OPTIONS,
  type InterfaceLanguageCode,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'

export const DEFAULT_PUBLIC_LOCALE: InterfaceLanguageCode = 'en'

export const PUBLIC_LOCALES = INTERFACE_LANGUAGE_OPTIONS.map(
  (lang) => lang.code
)

const PUBLIC_HREFLANG_LOCALES = [
  DEFAULT_PUBLIC_LOCALE,
  ...PUBLIC_LOCALES.filter((locale) => locale !== DEFAULT_PUBLIC_LOCALE),
]

const PUBLIC_WEBSITE_PREFIXES = [
  '/about',
  '/blog',
  '/pricing',
  '/rankings',
  '/privacy-policy',
  '/refund-policy',
  '/user-agreement',
]

const TRUSTED_PUBLIC_ORIGIN = 'https://flatkey.ai'

export function isPublicLocale(
  value?: string | null
): value is InterfaceLanguageCode {
  return PUBLIC_LOCALES.some((locale) => locale === value)
}

function normalizePathname(pathname: string): string {
  if (!pathname) return '/'
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

export function getPathLocale(pathname: string): InterfaceLanguageCode | null {
  const firstSegment = normalizePathname(pathname).split('/')[1]
  return isPublicLocale(firstSegment) ? firstSegment : null
}

export function stripPathLocale(pathname: string): string {
  const normalized = normalizePathname(pathname)
  const locale = getPathLocale(normalized)
  if (!locale) return normalized

  const stripped = normalized.slice(locale.length + 1)
  return stripped === '' ? '/' : stripped
}

export function isPublicWebsitePath(pathname: string): boolean {
  const stripped = stripPathLocale(pathname)
  if (stripped === '/') return true
  return PUBLIC_WEBSITE_PREFIXES.some((prefix) => {
    return stripped === prefix || stripped.startsWith(`${prefix}/`)
  })
}

export function localizePublicPath(pathname: string, language: string): string {
  const locale = normalizeInterfaceLanguage(language) as InterfaceLanguageCode
  const stripped = stripPathLocale(pathname)

  if (locale === DEFAULT_PUBLIC_LOCALE) return stripped
  if (stripped === '/') return `/${locale}`
  return `/${locale}${stripped}`
}

export function getPublicPathLanguage(pathname: string): InterfaceLanguageCode {
  return getPathLocale(pathname) ?? DEFAULT_PUBLIC_LOCALE
}

export type PublicHrefLangLink = {
  hrefLang: InterfaceLanguageCode | 'x-default'
  href: string
}

export function getTrustedPublicOrigin(origin: string): string {
  try {
    const parsedOrigin = new URL(origin).origin
    if (parsedOrigin === TRUSTED_PUBLIC_ORIGIN) return parsedOrigin
  } catch {
    // Fall back to the canonical public origin for malformed runtime values.
  }

  return TRUSTED_PUBLIC_ORIGIN
}

export function buildPublicHrefLangLinks(
  origin: string,
  pathname: string
): PublicHrefLangLink[] {
  const normalizedOrigin = getTrustedPublicOrigin(origin).replace(/\/+$/, '')
  const alternates = PUBLIC_HREFLANG_LOCALES.map((locale) => ({
    hrefLang: locale,
    href: `${normalizedOrigin}${localizePublicPath(pathname, locale)}`,
  }))

  return [
    ...alternates,
    {
      hrefLang: 'x-default',
      href: `${normalizedOrigin}${localizePublicPath(
        pathname,
        DEFAULT_PUBLIC_LOCALE
      )}`,
    },
  ]
}
