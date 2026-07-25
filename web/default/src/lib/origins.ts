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

export const OFFICIAL_DOCUMENTATION_URL = 'https://docs.flatkey.ai/'

/**
 * Official-site paths stay canonical across console languages. The console
 * locale changes navigation labels, not the website destination.
 */
export function consoleWebsitePath(
  _language: string | undefined,
  path: string
): string {
  return path
}

export function officialWebsiteUrl(
  path: string,
  origin = OFFICIAL_WEBSITE_ORIGIN
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return origin ? `${normalizeOrigin(origin)}${normalizedPath}` : normalizedPath
}
