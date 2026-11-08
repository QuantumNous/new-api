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
} from '@/shared/components/ui/sidebar'
import { useLayout } from '@/shared/context/layout-provider'

import type { NavGroup } from '../types'
import { NavGroup as NavGroupView } from './nav-group'

type AppSidebarProps = {
  /** Navigation owned by the portal that renders this sidebar. */
  navGroups: NavGroup[]
}

/**
 * Application sidebar.
 *
 * The shell is shared, the navigation is not: each portal passes its own
 * groups, so the client sidebar cannot render an admin entry.
 */
export function AppSidebar(props: AppSidebarProps) {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarContent className='py-2'>
        <div className='flex flex-col'>
          {props.navGroups.map((group) => (
            <NavGroupView key={group.id || group.title} {...group} />
          ))}
        </div>
      </SidebarContent>

      <SidebarResizeHandle label={t('Resize sidebar')} />
      <SidebarRail />
    </Sidebar>
  )
}
