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
import { useLocation } from '@tanstack/react-router'
import { Compass, ExternalLink, Link2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { resolveSidebarView } from '@/components/layout/lib/sidebar-view-registry'
import type {
  NavCollapsible,
  NavGroup,
  ResolvedSidebarView,
  SidebarBadges,
} from '@/components/layout/types'
import { useModelPricingIssueBadge } from '@/features/system-settings/models/pricing-issues'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { useMediaQuery } from './use-media-query'
import { useSidebarConfig } from './use-sidebar-config'
import { useSidebarData } from './use-sidebar-data'
import { useTopNavLinks } from './use-top-nav-links'

/** Sentinel key used for the root navigation in animation `key=` props */
const ROOT_VIEW_KEY = '__root'

/**
 * Resolve the active sidebar view for the current location.
 *
 * - Returns the matching nested {@link SidebarView} (with its nav
 *   groups) when the URL belongs to a registered drill-in workspace.
 * - Otherwise returns the root navigation, narrowed by:
 *     · admin-only group visibility (role-based);
 *     · `useSidebarConfig` (admin × user `sidebar_modules` overlay).
 *
 * Nested views are intentionally NOT passed through `useSidebarConfig`
 * — those filters target known dashboard URLs only, and gating is
 * already enforced at the route level (`beforeLoad` redirects).
 */
export function useSidebarView(): ResolvedSidebarView {
  const { t } = useTranslation()
  const pathname = useLocation({ select: (l) => l.pathname })
  const userRole = useAuthStore((s) => s.auth.user?.role)
  const modelPricingBadge = useModelPricingIssueBadge()
  const badges: SidebarBadges = { modelPricing: modelPricingBadge }
  const rootSidebarData = useSidebarData(badges)
  const configFilteredRoot = useSidebarConfig(rootSidebarData.navGroups)
  // The header navigation is inline from `lg` up and hidden below it, so the
  // same links move into the main sidebar for phones and tablets only.
  const isCompactTopNav = useMediaQuery('(max-width: 1023px)')
  const topNavLinks = useTopNavLinks()

  const rootNavGroups = useMemo<NavGroup[]>(() => {
    const role = userRole ?? ROLE.GUEST
    const isAdmin = role >= ROLE.ADMIN
    const groups = configFilteredRoot
      .filter((group) => (group.id === 'admin' ? isAdmin : true))
      .map((group) => {
        const items = group.items.filter(
          (item) => item.requiredRole === undefined || role >= item.requiredRole
        )
        return items.length === group.items.length ? group : { ...group, items }
      })

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

  const view = resolveSidebarView(pathname)

  if (view) {
    return {
      key: view.id,
      view,
      navGroups: view.getNavGroups(t, badges),
    }
  }

  return {
    key: ROOT_VIEW_KEY,
    view: null,
    navGroups: rootNavGroups,
  }
}
