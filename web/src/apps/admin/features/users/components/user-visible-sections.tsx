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
import { useTranslation } from 'react-i18next'

import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { SIDEBAR_SECTIONS, type SidebarSection } from '@/shared/lib/sidebar-sections'
import { cn } from '@/shared/lib/utils'

/**
 * English source strings for each console section, used as i18n keys. They match
 * the corresponding sidebar entry labels so the admin sees the same names.
 */
const SECTION_LABEL_KEYS: Record<SidebarSection, string> = {
  dashboard: 'Dashboard',
  chat: 'Chat',
  playground: 'Playground',
  api_keys: 'API Keys',
  usage_logs: 'Usage Logs',
  task_logs: 'Task Logs',
  drawing_logs: 'Drawing Logs',
  audit_logs: 'Audit Logs',
  wallet: 'Wallet',
  profile: 'Profile',
  security: 'Security & Access',
  channels: 'Channels',
  models: 'Models',
  users: 'Users',
  redemption: 'Redemption Codes',
  subscriptions: 'Subscriptions',
  system_settings: 'System Settings',
  system_info: 'System Info',
  task_plugins: 'Task Plugins',
}

type UserVisibleSectionsProps = {
  value: string[] | undefined
  onChange: (sections: string[]) => void
}

/**
 * Toggle grid for the per-user console section allow-list. The value is the set
 * of granted sections; a switch that is on means the user may see that section.
 */
export function UserVisibleSections(props: UserVisibleSectionsProps) {
  const { t } = useTranslation()
  const granted = props.value ?? []

  const toggle = (section: SidebarSection, checked: boolean) => {
    const next = checked
      ? [...granted, section]
      : granted.filter((key) => key !== section)
    props.onChange(next)
  }

  return (
    <div className='grid gap-2 sm:grid-cols-2'>
      {SIDEBAR_SECTIONS.map((section) => {
        const checked = granted.includes(section)
        const switchId = `visible-section-${section}`
        return (
          <div
            key={section}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg border px-3 py-2',
              !checked && 'opacity-60'
            )}
          >
            <Label htmlFor={switchId} className='cursor-pointer text-sm'>
              {t(SECTION_LABEL_KEYS[section])}
            </Label>
            <Switch
              id={switchId}
              checked={checked}
              onCheckedChange={(next) => toggle(section, next)}
            />
          </div>
        )
      })}
    </div>
  )
}
