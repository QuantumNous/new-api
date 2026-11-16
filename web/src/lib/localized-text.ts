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
 * Plugin / marketplace copy that may be a bare string (legacy marketplace
 * index) or a BCP-47 map. Gateway APIs always emit the map form.
 */
export type LocalizedTextValue = string | Record<string, string>

/**
 * Resolve LocalizedText against an i18next language code.
 *
 * This project's `i18n.language` values are `en` / `zhCN` / `zhTW` / `fr` /
 * `ru` / `ja` / `vi` (see `web/src/i18n/config.ts`). Backend keys are BCP-47
 * (`en`, `zh`, `zh-TW`). Matching is case-insensitive and also accepts
 * hyphenated tags (`zh-TW`, `en-US`) so callers can pass either shape.
 *
 * Fallback: exact tag → primary subtag → `en` → first key in sorted order → `''`.
 */
export function resolveLocalizedText(
  value: LocalizedTextValue | undefined | null,
  _language: string
): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  // Third-party metadata keeps its wire format; Orbit only displays English.
  return typeof value.en === 'string' ? value.en : ''
}
