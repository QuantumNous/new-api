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
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'

/**
 * Footer block for the sidebar showing the system logo, name and version.
 * Collapses gracefully in icon-only sidebar mode (logo stays, text hides).
 */
export function SidebarVersionFooter() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { logo, systemName } = useSystemConfig()

  const name = status?.system_name || systemName
  const version = status?.version || t('Unknown version')

  return (
    <div className='flex items-center gap-2 rounded-lg px-2 py-1.5'>
      <div className='flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/10'>
        <img
          src={logo}
          alt={t('Logo')}
          className='size-full rounded-lg object-cover'
        />
      </div>
      <div className='min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden'>
        <div className='truncate text-xs font-medium'>{name}</div>
        <div className='truncate text-[10px] text-muted-foreground'>
          {version}
        </div>
      </div>
    </div>
  )
}
