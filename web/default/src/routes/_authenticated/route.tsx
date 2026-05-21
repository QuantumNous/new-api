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
import { AuthSessionPending } from '@/components/auth-session-pending'
import { AuthenticatedLayout } from '@/components/layout'
import { bootstrapUserAfterLogin } from '@/features/auth/lib/bootstrap-user'
import {
  isSessionVerified,
  markSessionVerified,
} from '@/features/auth/lib/session'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    if (!auth.user) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    if (isSessionVerified()) {
      return
    }

    const user = await bootstrapUserAfterLogin(auth.setUser, auth.user)
    if (user) {
      markSessionVerified()
      return
    }

    auth.reset()
    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
    })
  },
  pendingComponent: AuthSessionPending,
  pendingMs: 0,
  component: AuthenticatedLayout,
})
