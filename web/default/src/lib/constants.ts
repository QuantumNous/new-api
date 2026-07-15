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
export const DEFAULT_SYSTEM_NAME = 'Lighting'
export const DEFAULT_LOGO = '/lighting-mark.png'
export const DEFAULT_FAVICON = '/lighting-favicon.png?v=20260715-1'
export const LEGACY_DEFAULT_SYSTEM_NAME = 'New API'
export const LEGACY_DEFAULT_LOGO = '/logo.png'
export const LEGACY_SQUARE_LIGHTING_LOGO = '/lighting-favicon.png'
export const LEGACY_WIDE_LIGHTING_LOGO = '/lighting-logo.png'

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const
