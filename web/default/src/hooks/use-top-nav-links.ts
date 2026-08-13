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
import { OFFICIAL_DOCUMENTATION_URL } from '@/lib/origins'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

type BuildTopNavLinksOptions = {
  translate: (key: string) => string
}

export function buildTopNavLinks(
  options: BuildTopNavLinksOptions
): TopNavLink[] {
  // The console header intentionally carries a single entry: Docs. Website
  // destinations (blog, models, pricing, ...) stay on the official website
  // navigation instead of being mirrored here.
  return [
    {
      title: options.translate('Docs'),
      href: OFFICIAL_DOCUMENTATION_URL,
      external: true,
    },
  ]
}

/**
 * Console top navigation: a single Docs link to the standalone documentation
 * site. HeaderNavModules in /api/status no longer influences this menu.
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  return useMemo(() => buildTopNavLinks({ translate: t }), [t])
}
