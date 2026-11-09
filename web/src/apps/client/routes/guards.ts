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
import { redirect } from '@tanstack/react-router'

import { resolveAuthentication } from '@/shared/lib/auth-session'
import { isCrossOriginPortal, portalHref } from '@/shared/lib/portal-url'
import {
  firstVisibleClientPath,
  isSectionVisible,
  resolveSectionForUrl,
} from '@/shared/lib/sidebar-sections'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Client portal guard.
 *
 * The root guard may have skipped its session refresh because no session hint
 * was present; that skip is an optimization for public pages and must not
 * decide a protected route, so the session is resolved against the server
 * first. An in-memory session returns without a request.
 */
export async function requireClientAccess(locationHref: string): Promise<void> {
  const outcome = await resolveAuthentication()

  // Require a session the server has actually confirmed. Presence of a stale
  // in-memory token is not enough: an expired token whose refresh could not be
  // completed must not render protected UI, so it falls back to the login page.
  if (outcome.kind === 'authenticated') return

  if (isCrossOriginPortal('client')) {
    throw redirect({
      href: `${portalHref('client', '/login')}?redirect=${encodeURIComponent(locationHref)}`,
    })
  }

  throw redirect({
    to: '/login',
    search: { redirect: locationHref },
  })
}

/**
 * Client route visibility guard.
 *
 * `visible_sections` is enforced by the server on the APIs, but a page route
 * must decide before the component renders: otherwise a deep link shows a page
 * whose every request will fail with 403. Unmapped paths stay allowed so new
 * client features are not hidden by default, matching the sidebar filter.
 */
export function requireVisibleClientSection(locationHref: string): void {
  const sections = useAuthStore.getState().auth.user?.visible_sections
  // Empty or absent means unrestricted.
  if (!sections || sections.length === 0) return

  const pathname = new URL(locationHref, 'http://localhost').pathname
  if (isSectionVisible(sections, resolveSectionForUrl(pathname))) return

  const fallback = firstVisibleClientPath(sections)
  if (fallback && fallback !== pathname) {
    throw redirect({ href: fallback, replace: true })
  }

  throw redirect({ to: '/403', replace: true })
}
