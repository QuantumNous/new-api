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
import type { ContentSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { AnnouncementsSection } from './announcements-section'
import { FAQSection } from './faq-section'
import { UptimeKumaSection } from './uptime-kuma-section'

const CONTENT_SECTIONS = [
  {
    id: 'announcements',
    titleKey: 'Announcements',
    build: (settings: ContentSettings) => (
      <AnnouncementsSection
        enabled={settings['console_setting.announcements_enabled']}
        data={settings['console_setting.announcements']}
      />
    ),
  },
  {
    id: 'faq',
    titleKey: 'FAQ',
    build: (settings: ContentSettings) => (
      <FAQSection
        enabled={settings['console_setting.faq_enabled']}
        data={settings['console_setting.faq']}
      />
    ),
  },
  {
    id: 'uptime-kuma',
    titleKey: 'Uptime Kuma',
    build: (settings: ContentSettings) => (
      <UptimeKumaSection
        enabled={settings['console_setting.uptime_kuma_enabled']}
        data={settings['console_setting.uptime_kuma_groups']}
      />
    ),
  },
] as const

export type ContentSectionId = (typeof CONTENT_SECTIONS)[number]['id']

const contentRegistry = createSectionRegistry<
  ContentSectionId,
  ContentSettings
>({
  sections: CONTENT_SECTIONS,
  defaultSection: 'announcements',
  basePath: '/system-settings/content',
  urlStyle: 'path',
})

export const CONTENT_SECTION_IDS = contentRegistry.sectionIds
export const CONTENT_DEFAULT_SECTION = contentRegistry.defaultSection
export const getContentSectionNavItems = contentRegistry.getSectionNavItems
export const getContentSectionContent = contentRegistry.getSectionContent
export const getContentSectionMeta = contentRegistry.getSectionMeta
