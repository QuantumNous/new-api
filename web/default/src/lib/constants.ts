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
 * Application-wide constants
 */

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = '昀河星泽词元运营中心'
export const LEGACY_SYSTEM_NAMES = [
  'New API',
  'NEW API',
  'new-api',
  'One API',
  'ONE API',
  'one api',
] as const

const LEGACY_SYSTEM_NAME_LOOKUP = new Set(
  LEGACY_SYSTEM_NAMES.map((name) => name.toLowerCase())
)

/** Display-only: map legacy product names to the branded operations center name. */
export function normalizeSystemName(name?: string | null) {
  if (!name) return DEFAULT_SYSTEM_NAME
  const trimmed = name.trim()
  if (!trimmed) return DEFAULT_SYSTEM_NAME
  if (LEGACY_SYSTEM_NAME_LOOKUP.has(trimmed.toLowerCase())) {
    return DEFAULT_SYSTEM_NAME
  }
  return trimmed
}
export const DEFAULT_LOGO = '/logo.png'

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const
