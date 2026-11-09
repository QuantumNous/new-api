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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { DASHBOARD_DEFAULT_SECTION } from '@/apps/client/features/dashboard/section-registry'
import { SignUp } from '@/shared/features/auth/sign-up'
import { resolveAuthentication } from '@/shared/lib/auth-session'
import { isCrossOriginPortal, portalHref } from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
  beforeLoad: async () => {
    // Confirm the session against the server: an empty in-memory store does not
    // mean the visitor is anonymous while a valid refresh cookie exists.
    const outcome = await resolveAuthentication()
    if (outcome.kind !== 'authenticated') return

    const { auth } = useAuthStore.getState()

    // 如果已经有用户信息，说明已登录，注册页对其无意义，跳转到对应门户首页
    if (!auth.user) return

    if (auth.user.role >= ROLE.ADMIN) {
      if (isCrossOriginPortal('admin')) {
        throw redirect({ href: portalHref('admin', '/admin/overview') })
      }
      throw redirect({ to: '/admin/overview', replace: true })
    }

    throw redirect({
      to: '/app/workspace/$section',
      params: { section: DASHBOARD_DEFAULT_SECTION },
      replace: true,
    })
  },
})
