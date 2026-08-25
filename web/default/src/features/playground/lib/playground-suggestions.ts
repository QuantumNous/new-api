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
import { resolvePlaygroundModelKind } from './media-generation'

export type QuickStartMediaKind = 'image' | 'video'

const PREFERRED_MEDIA_MODELS: Record<QuickStartMediaKind, string> = {
  image: 'gpt-image-2',
  video: 'seedance-2.5',
}

export function resolveQuickStartModel(
  models: ModelOption[],
  kind: QuickStartMediaKind
): string | undefined {
  const preferredModel = PREFERRED_MEDIA_MODELS[kind]
  if (models.some((model) => model.value === preferredModel)) {
    return preferredModel
  }
  return models.find(
    (model) => resolvePlaygroundModelKind(model.value) === kind
  )?.value
}

export function shouldShowQuickStartSuggestions(text: string): boolean {
  return text.trim().length === 0
}
