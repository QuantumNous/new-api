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
import { useAuthStore } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { AuthenticatedLayout } from '@/components/layout'
import { safeRedirect } from '@/features/auth/lib/safe-redirect'
import {
  isSessionVerified,
  markSessionVerified,
  resetSessionVerified,
} from '@/features/auth/lib/session-verification'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    // 如果本地没有用户信息，直接跳转登录页
    if (!auth.user) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: safeRedirect(
            `${location.pathname}${location.search}`,
            '/dashboard'
          ),
        },
      })
    }

    // 本地有用户信息，但需要验证 session 是否有效（每个会话只验证一次）
    if (!isSessionVerified()) {
      const res = await getSelf().catch((err: unknown) =>
        (err as { response?: { status?: number } })?.response?.status === 401
          ? { success: false }
          : null
      )
      if (res?.success && res.data) {
        // 验证成功，更新用户信息（可能有变化）
        auth.setUser(res.data)
        markSessionVerified()
      } else if (res) {
        // only 401 clears session
        resetSessionVerified()
        auth.reset()
        throw redirect({
          to: '/sign-in',
          search: {
            redirect: safeRedirect(
              `${location.pathname}${location.search}`,
              '/dashboard'
            ),
          },
        })
      }
    }
  },
  component: AuthenticatedLayout,
})
