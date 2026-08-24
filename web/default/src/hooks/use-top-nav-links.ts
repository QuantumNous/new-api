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
import { useAuthStore } from '@/stores/auth-store'
import {
  type HeaderNavModules,
  parseHeaderNavModulesFromStatus,
} from '@/lib/nav-modules'
import {
  OFFICIAL_DOCUMENTATION_URL,
  consoleWebsitePath,
  officialWebsiteUrl,
} from '@/lib/origins'
import { useStatus } from '@/hooks/use-status'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

type BuildTopNavLinksOptions = {
  translate: (key: string) => string
  language?: string
  modules: HeaderNavModules
  isAuthed: boolean
}

export function buildTopNavLinks(
  options: BuildTopNavLinksOptions
): TopNavLink[] {
  const links: TopNavLink[] = []
  const websitePath = (path: string) =>
    consoleWebsitePath(options.language, path)
  const websiteLink = (title: string, path: string): TopNavLink => {
    const href = officialWebsiteUrl(websitePath(path))
    return { title, href, external: href.startsWith('http') }
  }

  // Follow the remaining official website primary navigation order.
  links.push(websiteLink(options.translate('Blog'), '/blog'))
  links.push(websiteLink(options.translate('Models'), '/models'))
  links.push({
    title: options.translate('Docs'),
    href: OFFICIAL_DOCUMENTATION_URL,
    external: true,
  })

  const pricing = options.modules.pricing
  if (pricing.enabled) {
    const href = officialWebsiteUrl(websitePath('/pricing'))
    links.push({
      title: options.translate('Pricing (website navigation)'),
      href,
      requiresAuth: pricing.requireAuth && !options.isAuthed,
      external: href.startsWith('http'),
    })
  }

  links.push(websiteLink(options.translate('Compute'), '/compute'))
  links.push(websiteLink(options.translate('Use cases'), '/usecases'))

  return links
}

/** The console header carries a single entry: Docs. */
export function buildConsoleTopNavLinks(
  translate: (key: string) => string
): TopNavLink[] {
  return [
    {
      title: translate('Docs'),
      href: OFFICIAL_DOCUMENTATION_URL,
      external: true,
    },
  ]
}

/**
 * Generate top navigation links based on HeaderNavModules configuration from backend /api/status
 * Backend format example (stringified JSON):
 * {
 *   home: true,
 *   console: true,
 *   pricing: { enabled: true, requireAuth: false },
 *   rankings: { enabled: true, requireAuth: false }
 * }
 * Website entries resolve through OFFICIAL_WEBSITE_ORIGIN, while Docs uses
 * the standalone documentation site. Pricing retains its existing
 * enable/require-auth controls. Rankings config is still parsed from shared
 * status but is not emitted by console top navigation.
 *
 * Public pages (PublicHeader / PublicNavigation) consume this hook; the
 * authenticated console header uses useConsoleTopNavLinks instead.
 */
export function useTopNavLinks(): TopNavLink[] {
  const { t, i18n } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  // Parse HeaderNavModules
  const modules = useMemo(() => {
    return parseHeaderNavModulesFromStatus(
      status as Record<string, unknown> | null
    )
  }, [status])

  return buildTopNavLinks({
    translate: t,
    language: i18n.language,
    modules,
    isAuthed: !!auth?.user,
  })
}

/**
 * Console top navigation: a single Docs link to the standalone documentation
 * site. Public-page navigation keeps the full useTopNavLinks set.
 */
export function useConsoleTopNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  return useMemo(() => buildConsoleTopNavLinks(t), [t])
}
