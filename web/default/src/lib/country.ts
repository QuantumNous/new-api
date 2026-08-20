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
 * Render an ISO 3166-1 alpha-2 country code as a flag emoji + localized country
 * name, e.g. "US" -> "🇺🇸 United States" (en) or "🇺🇸 美国" (zh). Returns an
 * empty string for empty/invalid codes so callers can fall back to "-".
 */
export function countryLabel(code: string, locale: string): string {
  if (!code || code.length !== 2) return ''
  const cc = code.toUpperCase()
  const flag = String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)
  )
  let name = cc
  try {
    name = new Intl.DisplayNames([locale], { type: 'region' }).of(cc) ?? cc
  } catch {
    // fall back to the bare code
  }
  return `${flag} ${name}`
}
