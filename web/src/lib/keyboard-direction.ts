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
import type { TextDirection } from '@/i18n/languages'

const MIRRORED_ARROW_KEYS: Record<string, string> = {
  ArrowLeft: 'ArrowRight',
  ArrowRight: 'ArrowLeft',
}

/**
 * Horizontal arrow keys follow the visual layout, which reverses in
 * right-to-left languages: ArrowRight means "previous" there. Returns the key
 * as it reads in logical (start to end) terms, so handlers can keep treating
 * ArrowLeft as "previous" and ArrowRight as "next" in both directions.
 */
export function toLogicalArrowKey(
  key: string,
  direction: TextDirection
): string {
  return direction === 'rtl' ? (MIRRORED_ARROW_KEYS[key] ?? key) : key
}
