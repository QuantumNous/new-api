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
import { ExternalLink, Link2 } from 'lucide-react'
import { useMemo } from 'react'

import type { NavGroup, NavLink } from '@/shared/components/layout/types'
import { ROLE } from '@/shared/lib/roles'
import { filterNavGroupsByVisibleSections } from '@/shared/lib/sidebar-sections'
import { useAuthStore } from '@/shared/stores/auth-store'

import { useMediaQuery } from './use-media-query'
import { useSidebarConfig } from './use-sidebar-config'
import { useTopNavLinks } from './use-top-nav-links'

type SidebarViewOptions = {
  /**
   * Append the public header links to the navigation on compact viewports,
   * where the header navigation is not rendered.
   */
  includeTopNavLinks?: boolean
}

/**
 * Narrow a portal's navigation for display.
 *
 * The portal owns the navigation data; this hook applies the cross-cutting
 * visibility rules:
 *   · per-item role visibility (`requiredRole`), which mirrors the route guard;
 *   · `useSidebarConfig` (admin × user `sidebar_modules` overlay);
 *   · the administrator-managed `visible_sections` allow-list.
 */
export function useSidebarView(
  navGroups: NavGroup[],
  options: SidebarViewOptions = {}
): { navGroups: NavGroup[] } {
  const userRole = useAuthStore((s) => s.auth.user?.role)
  const visibleSections = useAuthStore((s) => s.auth.user?.visible_sections)
  const configFiltered = useSidebarConfig(navGroups)
  // Administrator-managed allow-list, applied after the admin × user overlay.
  const sectionFiltered = useMemo(
    () => filterNavGroupsByVisibleSections(configFiltered, visibleSections),
    [configFiltered, visibleSections]
  )
  // The header navigation is inline from `lg` up and hidden below it, so the
  // same links join the main sidebar for phones and tablets only.
  const isCompactTopNav = useMediaQuery('(max-width: 1023px)')
  const topNavLinks = useTopNavLinks()

  const result = useMemo<NavGroup[]>(() => {
    const role = userRole ?? ROLE.GUEST
    const groups = sectionFiltered
      .map((group) => {
        const items = group.items.filter(
          (item) => item.requiredRole === undefined || role >= item.requiredRole
        )
        return items.length === group.items.length ? group : { ...group, items }
      })
      .filter((group) => group.items.length > 0)

    if (
      !options.includeTopNavLinks ||
      !isCompactTopNav ||
      topNavLinks.length === 0
    ) {
      return groups
    }

    // Insert after the API keys entry, wherever the portal places it.
    const apiGroupIndex = groups.findIndex((group) =>
      group.items.some((item) => item.url === '/app/keys')
    )
    if (apiGroupIndex === -1) {
      return groups
    }

    const apiGroup = groups[apiGroupIndex]
    const apiKeysIndex = apiGroup.items.findIndex(
      (item) => item.url === '/app/keys'
    )
    const insertIndex =
      apiKeysIndex === -1 ? apiGroup.items.length : apiKeysIndex + 1
    const headerLinks: NavLink[] = topNavLinks.map((link) => ({
      title: link.title,
      url: link.href,
      external: link.external,
      icon: link.external ? ExternalLink : Link2,
    }))

    return groups.map((group, index) =>
      index === apiGroupIndex
        ? {
            ...group,
            items: [
              ...apiGroup.items.slice(0, insertIndex),
              ...headerLinks,
              ...apiGroup.items.slice(insertIndex),
            ],
          }
        : group
    )
  }, [
    sectionFiltered,
    isCompactTopNav,
    topNavLinks,
    userRole,
    options.includeTopNavLinks,
  ])

  return { navGroups: result }
}
