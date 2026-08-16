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
import { useTranslation } from 'react-i18next'

import {
  parseCustomNavItems,
  resolveCustomNavLabel,
  type CustomNavItem,
} from '@/features/system-settings/maintenance/custom-nav-config'
import { useStatus } from '@/hooks/use-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export type ResolvedCustomNavItem = CustomNavItem & {
  label: string
  url: string
}

export function buildCustomNavUrl(id: string): string {
  return `/custom/${id}`
}

/**
 * Custom navigation items configured by administrators. Items placed in the
 * `admin` sidebar category are only returned for admin users so their content
 * stays hidden from ordinary users.
 */
export function useCustomNavItems(): ResolvedCustomNavItem[] {
  const { i18n } = useTranslation()
  const { status } = useStatus()
  const user = useAuthStore((state) => state.auth.user)

  const language = i18n.language
  const raw = status?.CustomNavItems as string | null | undefined
  const isAdmin = (user?.role ?? ROLE.USER) >= ROLE.ADMIN

  return useMemo(() => {
    return parseCustomNavItems(raw)
      .filter((item) => item.enabled)
      .filter((item) => item.sidebarSection !== 'admin' || isAdmin)
      .map((item) => ({
        ...item,
        label: resolveCustomNavLabel(item, language),
        url: buildCustomNavUrl(item.id),
      }))
  }, [raw, language, isAdmin])
}
