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

import type {
  NavGroup,
  NavLink,
  SidebarBadges,
} from '@/components/layout/types'
import { useModelPricingIssueBadge } from '@/features/system-settings/models/pricing-issues'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useMediaQuery } from './use-media-query'
import { useSidebarConfig } from './use-sidebar-config'
import { useSidebarData } from './use-sidebar-data'
import { useTopNavLinks } from './use-top-nav-links'

/**
 * Resolve the navigation for the one main application sidebar.
 *
 * The sidebar is always the root navigation — including on system settings
 * pages, which no longer swap in a separate mini-dashboard. It is narrowed by:
 *   · per-item role visibility (`requiredRole`), which mirrors the route guard
 *     for the admin and super administrator entries spread across the groups;
 *   · `useSidebarConfig` (admin × user `sidebar_modules` overlay);
 *   · adding the header links below `API Keys` below the `lg` breakpoint.
 */
export function useSidebarView(): { navGroups: NavGroup[] } {
  const userRole = useAuthStore((s) => s.auth.user?.role)
  const modelPricingBadge = useModelPricingIssueBadge()
  const badges: SidebarBadges = { modelPricing: modelPricingBadge }
  const rootSidebarData = useSidebarData(badges)
  const configFilteredRoot = useSidebarConfig(rootSidebarData.navGroups)
  // The header navigation is inline from `lg` up and hidden below it, so the
  // same links join the main sidebar for phones and tablets only.
  const isCompactTopNav = useMediaQuery('(max-width: 1023px)')
  const topNavLinks = useTopNavLinks()

  const navGroups = useMemo<NavGroup[]>(() => {
    const role = userRole ?? ROLE.GUEST
    const groups = configFilteredRoot
      .map((group) => {
        const items = group.items.filter(
          (item) => item.requiredRole === undefined || role >= item.requiredRole
        )
        return items.length === group.items.length ? group : { ...group, items }
      })
      .filter((group) => group.items.length > 0)

    if (!isCompactTopNav || topNavLinks.length === 0) {
      return groups
    }

    const apiGroupIndex = groups.findIndex((group) => group.id === 'api-models')
    if (apiGroupIndex === -1) {
      return groups
    }

    const apiGroup = groups[apiGroupIndex]
    const apiKeysIndex = apiGroup.items.findIndex(
      (item) => item.url === '/keys'
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
  }, [configFilteredRoot, isCompactTopNav, topNavLinks, userRole])

  return { navGroups }
}
