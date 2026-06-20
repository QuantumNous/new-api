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
import { Link, useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { getNavGroupsForPath } from '../lib/workspace-registry'
import { type NavLink } from '../types'
import { cn } from '@/lib/utils'

function isNavLink(item: unknown): item is NavLink {
  return typeof (item as NavLink).url === 'string'
}

export function MobileNavTabs() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const sidebarData = useSidebarData()
  const allNavGroups = getNavGroupsForPath(pathname, t) || sidebarData.navGroups
  const configFilteredNavGroups = useSidebarConfig(allNavGroups)

  const tabs = useMemo(() => {
    const isAdmin = userRole && userRole >= ROLE.ADMIN
    return configFilteredNavGroups
      .filter((group) => (group.id === 'admin' ? isAdmin : true))
      .flatMap((group) => group.items)
      .filter(isNavLink)
  }, [configFilteredNavGroups, userRole])

  return (
    <div className='no-scrollbar sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-3 py-2 md:hidden'>
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.url ||
          (tab.activeUrls?.some((u) => pathname === u) ?? false)
        return (
          <Link
            key={String(tab.url)}
            to={tab.url as string}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'bg-sidebar-foreground text-sidebar'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground'
            )}
          >
            {tab.title}
          </Link>
        )
      })}
    </div>
  )
}
