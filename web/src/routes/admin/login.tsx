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
import { z } from 'zod'

import { AdminLogin } from '@/apps/admin/pages/admin-login'
import { resolveAuthentication } from '@/shared/lib/auth-session'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

/**
 * Admin login lives outside the `_admin` branch so an anonymous visitor can
 * reach it. An administrator who is already signed in goes straight to the
 * console; a regular user is sent back to the client login.
 */
export const Route = createFileRoute('/admin/login')({
  component: AdminLogin,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    await resolveAuthentication()

    const { auth } = useAuthStore.getState()
    if (!auth.user) return

    if (auth.user.role >= ROLE.ADMIN) {
      throw redirect({ to: '/admin/overview', replace: true })
    }

    throw redirect({ to: '/login', replace: true })
  },
})
