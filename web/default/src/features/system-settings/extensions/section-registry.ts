/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createElement } from 'react'

import type { ExtensionsSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import { AvailabilityMonitorSection } from './availability-monitor-section'
import { CustomPagesSection } from './custom-pages-section'
import {
  DEFAULT_EXTENSION_VISIBILITY,
  resolveExtensionVisibility,
} from './constants'

const EXTENSIONS_SECTIONS = [
  {
    id: 'pages',
    titleKey: 'Custom Pages',
    build: (settings: ExtensionsSettings) =>
      createElement(CustomPagesSection, {
        data: settings['console_setting.custom_pages'],
      }),
  },
  {
    id: 'availability',
    titleKey: 'Availability Monitor',
    build: (settings: ExtensionsSettings) =>
      createElement(AvailabilityMonitorSection, {
        defaultValues: {
          'console_setting.availability_monitor_enabled':
            settings['console_setting.availability_monitor_enabled'],
          'console_setting.availability_monitor_visibility':
            resolveExtensionVisibility(
              settings['console_setting.availability_monitor_visibility'] ||
                DEFAULT_EXTENSION_VISIBILITY
            ),
          'console_setting.availability_monitor_refresh_interval':
            settings['console_setting.availability_monitor_refresh_interval'],
        },
      }),
  },
] as const

export type ExtensionsSectionId = (typeof EXTENSIONS_SECTIONS)[number]['id']

const extensionsRegistry = createSectionRegistry<
  ExtensionsSectionId,
  ExtensionsSettings
>({
  sections: EXTENSIONS_SECTIONS,
  defaultSection: 'pages',
  basePath: '/system-settings/extensions',
  urlStyle: 'path',
})

export const EXTENSIONS_SECTION_IDS = extensionsRegistry.sectionIds
export const EXTENSIONS_DEFAULT_SECTION = extensionsRegistry.defaultSection
export const getExtensionsSectionNavItems =
  extensionsRegistry.getSectionNavItems
export const getExtensionsSectionContent = extensionsRegistry.getSectionContent
export const getExtensionsSectionMeta = extensionsRegistry.getSectionMeta
