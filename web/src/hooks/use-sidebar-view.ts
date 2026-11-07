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
import { Compass, ExternalLink, Link2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { NavCollapsible, NavGroup, SidebarBadges } from '@/components/layout/types'
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
 *   · admin/settings role visibility;
 *   · `useSidebarConfig` (admin × user `sidebar_modules` overlay);
 *   · moving the header links into it below the `lg` breakpoint.
 */
export function useSidebarView(): { navGroups: NavGroup[] } {
  const { t } = useTranslation()
  const userRole = useAuthStore((s) => s.auth.user?.role)
  const modelPricingBadge = useModelPricingIssueBadge()
  const badges: SidebarBadges = { modelPricing: modelPricingBadge }
  const rootSidebarData = useSidebarData(badges)
  const configFilteredRoot = useSidebarConfig(rootSidebarData.navGroups)
  // The header navigation is inline from `lg` up and hidden below it, so the
  // same links move into the main sidebar for phones and tablets only.
  const isCompactTopNav = useMediaQuery('(max-width: 1023px)')
  const topNavLinks = useTopNavLinks()

  const navGroups = useMemo<NavGroup[]>(() => {
    const role = userRole ?? ROLE.GUEST
    const isAdmin = role >= ROLE.ADMIN
    const groups = configFilteredRoot
      .filter((group) => {
        if (group.id === 'admin') return isAdmin
        if (group.id === 'system-settings') return role >= ROLE.SUPER_ADMIN
        return true
      })
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

    const generalIndex = groups.findIndex((group) => group.id === 'general')
    if (generalIndex === -1) {
      return groups
    }

    const general = groups[generalIndex]
    const apiKeysIndex = general.items.findIndex((item) => item.url === '/keys')
    const insertIndex =
      apiKeysIndex === -1 ? general.items.length : apiKeysIndex + 1
    const navigation: NavCollapsible = {
      title: t('Navigation'),
      icon: Compass,
      items: topNavLinks.map((link) => ({
        title: link.title,
        url: link.href,
        external: link.external,
        icon: link.external ? ExternalLink : Link2,
      })),
    }

    return groups.map((group, index) =>
      index === generalIndex
        ? {
            ...group,
            items: [
              ...general.items.slice(0, insertIndex),
              navigation,
              ...general.items.slice(insertIndex),
            ],
          }
        : group
    )
  }, [configFilteredRoot, isCompactTopNav, t, topNavLinks, userRole])

  return { navGroups }
}
