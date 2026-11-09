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
