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
import type { TFunction } from 'i18next'

const ENDPOINT_TYPE_LABEL_KEYS: Record<string, string> = {
  openai: 'Chat',
  'openai-response': 'Response',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  'jina-rerank': 'Rerank',
  'image-generation': 'Image',
  embeddings: 'Embeddings',
  'openai-video': 'Video',
  'deepseek-tools-search': 'Search',
  'deepseek-tools-fetch': 'Fetch',
}

export function getEndpointTypeLabel(
  endpointType: string,
  t: TFunction
): string {
  const labelKey = ENDPOINT_TYPE_LABEL_KEYS[endpointType]
  return labelKey ? t(labelKey) : endpointType
}
