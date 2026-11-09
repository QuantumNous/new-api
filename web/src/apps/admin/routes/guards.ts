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
import { t } from 'i18next'
import { toast } from 'sonner'

import { DASHBOARD_DEFAULT_SECTION } from '@/apps/client/features/dashboard/section-registry'
import { resolveAuthentication } from '@/shared/lib/auth-session'
import { isCrossOriginPortal, portalHref } from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Admin portal guard.
 *
 * Runs on every admin route (the parent `_admin` layout route), after the
 * session has been resolved against the server. Anonymous visitors are sent to
 * the admin login, and authenticated users below the Admin role are denied and
 * returned to the client portal with an "Access Denied" toast.
 */
export async function requireAdminAccess(locationHref: string): Promise<void> {
  const outcome = await resolveAuthentication()

  const { auth } = useAuthStore.getState()

  // Only a server-confirmed session may reach the admin portal. A stale,
  // expired in-memory token whose refresh could not be confirmed is treated as
  // anonymous so the console is never rendered against an unverified session.
  if (outcome.kind !== 'authenticated' || !auth.user || !auth.accessToken) {
    if (isCrossOriginPortal('admin')) {
      throw redirect({
        href: `${portalHref('admin', '/admin/login')}?redirect=${encodeURIComponent(locationHref)}`,
      })
    }
    throw redirect({
      to: '/admin/login',
      search: { redirect: locationHref },
    })
  }

  if (auth.user.role >= ROLE.ADMIN) return

  toast.error(t('Access Denied'), {
    description: t('You do not have permission to access the admin portal.'),
  })

  if (isCrossOriginPortal('client')) {
    throw redirect({ href: portalHref('client', '/app/workspace/overview') })
  }

  throw redirect({
    to: '/app/workspace/$section',
    params: { section: DASHBOARD_DEFAULT_SECTION },
  })
}
