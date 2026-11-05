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
import { Handshake, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { NavGroup, NavItem } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'

import { useHwText } from '../texts'

/**
 * Upstream sidebar entries that HisarWeb shows to administrators only, keyed by
 * the preset type or the URL the upstream item uses.
 */
const ADMIN_ONLY = new Set([
  'chat-presets',
  '/dashboard/models',
  '/usage-logs/audit',
  '/usage-logs/task',
])

function keyOf(item: NavItem): string {
  return item.type ?? item.url ?? ''
}

/**
 * HisarWeb additions to the root sidebar: the top-up entry, the partner
 * channels page and the administrator-only upstream entries. The upstream list
 * itself stays in `use-sidebar-data.ts`; this only decorates it.
 */
export function useHwSidebarExtras(groups: NavGroup[]): NavGroup[] {
  const { t } = useTranslation()
  const hw = useHwText()

  return groups.map((group) => {
    const items = group.items.map((item) =>
      ADMIN_ONLY.has(keyOf(item))
        ? { ...item, requiredRole: ROLE.ADMIN }
        : item
    )
    if (group.id === 'personal') {
      const buyCredit: NavItem = {
        title: hw('navBuy'),
        url: '/satin-al',
        icon: ShoppingCart,
      }
      return { ...group, items: [buyCredit, ...items] }
    }
    if (group.id === 'admin') {
      const anchor = items.findIndex(
        (item) => item.url === '/redemption-codes'
      )
      items.splice(anchor < 0 ? items.length : anchor, 0, {
        title: t('Partner Channels'),
        url: '/partner-channels',
        icon: Handshake,
      })
    }
    return { ...group, items }
  })
}
