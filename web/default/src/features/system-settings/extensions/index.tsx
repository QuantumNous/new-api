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
import { SettingsPage } from '../components/settings-page'
import type { ExtensionsSettings } from '../types'
import {
  EXTENSIONS_DEFAULT_SECTION,
  getExtensionsSectionContent,
  getExtensionsSectionMeta,
} from './section-registry'

const defaultExtensionsSettings: ExtensionsSettings = {
  'console_setting.custom_pages': '[]',
  'console_setting.availability_monitor_enabled': true,
  'console_setting.availability_monitor_visibility': 'all',
  'console_setting.availability_monitor_refresh_interval': 10,
}

export function ExtensionsSettingsPage() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/extensions/$section'
      defaultSettings={defaultExtensionsSettings}
      defaultSection={EXTENSIONS_DEFAULT_SECTION}
      getSectionContent={getExtensionsSectionContent}
      getSectionMeta={getExtensionsSectionMeta}
      loadingMessage='Loading extensions settings...'
    />
  )
}
