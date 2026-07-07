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
export function normalizeOrigin(origin: string | undefined): string {
  return origin?.trim().replace(/\/+$/, '') ?? ''
}

export const OFFICIAL_WEBSITE_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_OFFICIAL_WEBSITE_ORIGIN as string | undefined
)

/**
 * Locale-prefixed website path: the console UI language maps to the website's
 * /{locale} routes (English lives at the root). Keeps the language choice
 * when hopping console → website.
 */
export function localizedWebsitePath(
  language: string | undefined,
  path: string
): string {
  const lang = (language || 'en').split('-')[0]
  return lang && lang !== 'en' ? `/${lang}${path === '/' ? '' : path}` : path
}

export function officialWebsiteUrl(
  path: string,
  origin = OFFICIAL_WEBSITE_ORIGIN
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return origin ? `${normalizeOrigin(origin)}${normalizedPath}` : normalizedPath
}
