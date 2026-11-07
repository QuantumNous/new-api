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

import {
  Sidebar,
  SidebarContent,
  SidebarRail,
  SidebarResizeHandle,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { useSidebarView } from '@/hooks/use-sidebar-view'

import { NavGroup } from './nav-group'

/**
 * Application sidebar.
 *
 * The main navigation is the single sidebar for every authenticated page,
 * including system settings. `useSidebarView` applies role and sidebar-module
 * visibility, and injects the header links on compact viewports.
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const { navGroups } = useSidebarView()

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarContent className='py-2'>
        <div className='flex flex-col'>
          {navGroups.map((props) => (
            <NavGroup key={props.id || props.title} {...props} />
          ))}
        </div>
      </SidebarContent>

      <SidebarResizeHandle label={t('Resize sidebar')} />
      <SidebarRail />
    </Sidebar>
  )
}
