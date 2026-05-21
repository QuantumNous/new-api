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
import { useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { isAiocSidebarBrandHidden } from '@/config/aioc-demo-visibility'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { useLayout } from '@/context/layout-provider'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  getNavGroupsForPath,
  isInWorkspace,
  WORKSPACE_IDS,
} from '../lib/workspace-registry'
import { NavGroup } from './nav-group'
import { SidebarBackToOperationsConsole } from './sidebar-back-to-operations-console'
import { SystemBrand } from './system-brand'

/** Ops layout: hide sidebar header brand (duplicates top app bar). */
const hideSidebarBrand = isAiocSidebarBrandHidden()

const sidebarShellClassName = cn(
  '[&_[data-slot=sidebar-inner]]:border-white/10',
  '[&_[data-slot=sidebar-inner]]:bg-gradient-to-b',
  '[&_[data-slot=sidebar-inner]]:from-slate-950',
  '[&_[data-slot=sidebar-inner]]:via-slate-900',
  '[&_[data-slot=sidebar-inner]]:to-indigo-950',
  '[&_[data-slot=sidebar-inner]]:text-slate-100',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:border-white/10',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:bg-gradient-to-b',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:from-slate-950',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:via-slate-900',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:to-indigo-950',
  '[&_[data-sidebar=sidebar][data-mobile=true]]:text-slate-100'
)

const sidebarContentClassName = cn(
  'min-h-0 flex-1 overflow-y-auto px-2 py-3',
  '[&_[data-sidebar=group-label]]:text-xs [&_[data-sidebar=group-label]]:font-medium [&_[data-sidebar=group-label]]:tracking-wide [&_[data-sidebar=group-label]]:text-slate-400',
  '[&_[data-sidebar=menu-button]:hover]:bg-white/10 [&_[data-sidebar=menu-button]:hover]:text-slate-50',
  '[&_[data-sidebar=menu-sub]]:border-white/10',
  '[&_[data-sidebar=menu-sub-button]]:text-slate-400',
  '[&_[data-sidebar=menu-sub-button]:hover]:bg-white/10 [&_[data-sidebar=menu-sub-button]:hover]:text-slate-100',
  '[&_[data-active=true]]:bg-indigo-500/20 [&_[data-active=true]]:text-indigo-100',
  '[&_[data-active=true]]:shadow-[inset_0_0_0_1px_rgba(129,140,248,0.35)]',
  '[&_[data-active=true]_svg]:text-indigo-200'
)

/**
 * Application sidebar component
 * Fetches corresponding navigation menu from workspace registry based on current path
 * Dynamically filters navigation items based on backend SidebarModulesAdmin configuration
 *
 * Automatically matches workspace configuration for current path through workspace registry system
 * Adding new workspaces only requires registration in workspace-registry.ts
 */
export function AppSidebar() {
  const { t } = useTranslation()
  const { collapsible, variant } = useLayout()
  const { pathname } = useLocation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const sidebarData = useSidebarData()

  // Get navigation group configuration corresponding to current path from workspace registry
  const allNavGroups = getNavGroupsForPath(pathname, t) || sidebarData.navGroups

  // Filter sidebar navigation items based on backend configuration
  const configFilteredNavGroups = useSidebarConfig(allNavGroups)

  // Filter navigation groups based on user role
  // Non-Admin users cannot see Admin navigation group
  const currentNavGroups = useMemo(() => {
    const isAdmin = userRole && userRole >= ROLE.ADMIN
    return configFilteredNavGroups.filter((group) => {
      if (group.id === 'admin') {
        return isAdmin
      }
      return true
    })
  }, [configFilteredNavGroups, userRole])

  const isSystemSettingsWorkspace = isInWorkspace(
    pathname,
    WORKSPACE_IDS.SYSTEM_SETTINGS
  )

  return (
    <Sidebar
      collapsible={collapsible}
      variant={variant}
      className={sidebarShellClassName}
    >
      {!hideSidebarBrand ? (
        <SidebarHeader className='border-b border-white/10 px-2 py-3'>
          <SystemBrand variant='sidebar' />
        </SidebarHeader>
      ) : null}
      <SidebarContent
        className={cn(sidebarContentClassName, hideSidebarBrand && 'pt-2')}
      >
        {isSystemSettingsWorkspace ? <SidebarBackToOperationsConsole /> : null}
        {currentNavGroups.map((props) => {
          const key = props.id || props.title
          return <NavGroup key={key} {...props} />
        })}
      </SidebarContent>
      <SidebarRail className='hover:after:bg-indigo-400/40' />
    </Sidebar>
  )
}
