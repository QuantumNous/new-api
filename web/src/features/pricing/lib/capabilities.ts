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
import type { PricingModel } from '../types'
import { parseTags } from './filters'

export type CapabilityTabValue =
  | 'all'
  | 'text'
  | 'code'
  | 'multimodal'
  | 'image'
  | 'video'

export interface CapabilityTab {
  value: CapabilityTabValue
  /** i18n label key */
  labelKey: string
}

export const CAPABILITY_TABS: CapabilityTab[] = [
  { value: 'all', labelKey: 'All' },
  { value: 'text', labelKey: 'Text' },
  { value: 'code', labelKey: 'Code' },
  { value: 'multimodal', labelKey: 'Multimodal' },
  { value: 'image', labelKey: 'Image' },
  { value: 'video', labelKey: 'Video' },
]

/** tag → 所属 Tab 集合 */
const TAB_TAGS: Record<Exclude<CapabilityTabValue, 'all'>, string[]> = {
  text: ['chat', 'completion', 'reasoning', 'embedding'],
  code: ['code'],
  multimodal: ['vision', 'audio'],
  image: ['image'],
  video: ['video'],
}

export function matchesCapabilityTab(
  model: PricingModel,
  tab: CapabilityTabValue
): boolean {
  if (tab === 'all') return true
  const tags = parseTags(model.tags).map((t) => t.toLowerCase())
  return TAB_TAGS[tab].some((t) => tags.includes(t))
}
