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
  type InterfaceLanguageCode,
  isInterfaceLanguageCode,
} from './languages'

export const LANGUAGE_PREFERENCE_COOKIE = 'fk_locale'

const LANGUAGE_PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

function getCookieDomain(): string | undefined {
  const domain = import.meta.env.VITE_COOKIE_SESSION_DOMAIN?.trim()
  return domain || undefined
}

function normalizePreference(value?: string | null): InterfaceLanguageCode | null {
  const normalized = value?.trim().replace(/_/g, '-').toLowerCase()
  if (!normalized) return null

  const primary = normalized.startsWith('zh')
    ? 'zh'
    : normalized.split('-')[0]
  return isInterfaceLanguageCode(primary) ? primary : null
}

export function getLanguagePreferenceCookie(): InterfaceLanguageCode | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${LANGUAGE_PREFERENCE_COOKIE}=`))

  const preferences = new Set<InterfaceLanguageCode>()

  for (const cookie of cookies) {
    const value = cookie.slice(LANGUAGE_PREFERENCE_COOKIE.length + 1)
    try {
      const normalized = normalizePreference(decodeURIComponent(value))
      if (normalized) preferences.add(normalized)
    } catch {
      /* Ignore malformed legacy cookie values and continue to later duplicates. */
    }
  }

  if (preferences.size !== 1) return null
  const [preference] = preferences
  return preference ?? null
}

export function buildLanguagePreferenceCookie(
  language: string,
  domain?: string | null
): string | null {
  const normalized = normalizePreference(language)
  if (!normalized) return null

  const normalizedDomain = domain?.trim()
  const domainAttribute = normalizedDomain ? `; Domain=${normalizedDomain}` : ''

  return `${LANGUAGE_PREFERENCE_COOKIE}=${encodeURIComponent(
    normalized
  )}; Path=/${domainAttribute}; Max-Age=${LANGUAGE_PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`
}

export function buildLanguagePreferenceCookieWrites(language: string): string[] {
  const domain = getCookieDomain()
  const cookie = buildLanguagePreferenceCookie(language, domain)
  if (!cookie) return []
  if (!domain) return [cookie]

  return [
    `${LANGUAGE_PREFERENCE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`,
    cookie,
  ]
}

export function persistLanguagePreferenceCookie(
  language: string
): InterfaceLanguageCode | null {
  const normalized = normalizePreference(language)
  if (!normalized || typeof document === 'undefined') return normalized

  for (const cookie of buildLanguagePreferenceCookieWrites(normalized)) {
    document.cookie = cookie
  }

  return normalized
}
