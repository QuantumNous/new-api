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
import type { ModelOption } from '../types'

/**
 * Media quick-start entries are intentionally bound to one concrete model.
 * A prompt must not silently switch to another model in the same media family.
 */
export const QUICK_START_MODELS = {
  image: 'gpt-image-2',
  video: 'seedance-2.5',
} as const

export type QuickStartMediaKind = keyof typeof QUICK_START_MODELS

export function isQuickStartModelAvailable(
  models: ModelOption[],
  model: string
): boolean {
  return models.some((item) => item.value === model)
}

export function shouldShowQuickStartSuggestions(text: string): boolean {
  return text.trim().length === 0
}
