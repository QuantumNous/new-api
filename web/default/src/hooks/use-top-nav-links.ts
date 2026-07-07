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
import { localizedWebsitePath, officialWebsiteUrl } from '@/lib/origins'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { useStatus } from '@/hooks/use-status'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
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
 * Pricing and Rankings link to the official website pages (OFFICIAL_WEBSITE_ORIGIN)
 * — the website /rankings now serves the same daily-updated data pipeline. The
 * /docs and /about routes are no longer surfaced here.
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

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  // Mirror the official website header (Home, Blog, Pricing, Models,
  // Rankings, Contact us) so public console pages align with the site.
  // Carry the console UI language as the website locale path prefix so the
  // language choice survives the hop (English lives at the root path).
  const localizedPath = (path: string) =>
    localizedWebsitePath(i18n.language, path)
  const websiteLink = (title: string, path: string): TopNavLink => {
    const href = officialWebsiteUrl(localizedPath(path))
    return { title, href, external: href.startsWith('http') }
  }

  links.push(websiteLink(t('Home'), '/'))
  links.push(websiteLink(t('Blog'), '/blog'))

  // Pricing — official website page, not the in-console pricing route
  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const requiresAuth = pricing.requireAuth && !isAuthed
    const href = officialWebsiteUrl(localizedPath('/pricing'))
    links.push({
      title: t('Pricing'),
      href,
      requiresAuth,
      external: href.startsWith('http'),
    })
  }

  links.push(websiteLink(t('Models'), '/models'))

  // Rankings — official website page; it now serves the same daily-updated
  // data pipeline, and it is the single public rankings surface.
  const rankings = modules?.rankings
  if (rankings && typeof rankings === 'object' && rankings.enabled) {
    const requiresAuth = rankings.requireAuth && !isAuthed
    const href = officialWebsiteUrl(localizedPath('/rankings'))
    links.push({
      title: t('Rankings'),
      href,
      requiresAuth,
      external: href.startsWith('http'),
    })
  }

  links.push(websiteLink(t('Contact us'), '/contact'))

  return links
}
