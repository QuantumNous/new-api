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
import type { BusinessFallbackSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { BusinessFallbackConfigSection } from './config-section'

const BUSINESS_FALLBACK_SECTIONS = [
  {
    id: 'config',
    titleKey: 'Business Fallback',
    build: (settings: BusinessFallbackSettings) => (
      <BusinessFallbackConfigSection
        value={settings['business_fallback.config']}
      />
    ),
  },
] as const

export type BusinessFallbackSectionId =
  (typeof BUSINESS_FALLBACK_SECTIONS)[number]['id']

const businessFallbackRegistry = createSectionRegistry<
  BusinessFallbackSectionId,
  BusinessFallbackSettings
>({
  sections: BUSINESS_FALLBACK_SECTIONS,
  defaultSection: 'config',
  basePath: '/system-settings/business-fallback',
  urlStyle: 'path',
})

export const BUSINESS_FALLBACK_SECTION_IDS = businessFallbackRegistry.sectionIds
export const BUSINESS_FALLBACK_DEFAULT_SECTION =
  businessFallbackRegistry.defaultSection
export const getBusinessFallbackSectionNavItems =
  businessFallbackRegistry.getSectionNavItems
export const getBusinessFallbackSectionContent =
  businessFallbackRegistry.getSectionContent
export const getBusinessFallbackSectionMeta =
  businessFallbackRegistry.getSectionMeta
