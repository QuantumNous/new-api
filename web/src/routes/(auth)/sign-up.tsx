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

import { SignUp } from '@/features/auth/sign-up'
import { useAuthStore } from '@/stores/auth-store'

function getCachedStatus(): Record<string, unknown> | null {
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('status')
      if (!saved) return null
      const parsed = JSON.parse(saved)
      // Validate cache freshness - only use if less than 5 minutes old
      if (parsed._cachedAt && Date.now() - parsed._cachedAt < 5 * 60 * 1000) {
        return parsed
      }
      return null
    }
  } catch {
    /* empty */
  }
  return null
}

export const Route = createFileRoute('/(auth)/sign-up')({
  component: SignUp,
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    // 如果已经有用户信息，说明已登录，注册页对其无意义，跳转到 dashboard
    if (auth.user) {
      throw redirect({ to: '/dashboard' })
    }

    // 如果注册被禁用，跳转到登录页 (读取 localStorage 缓存，无 API 调用)
    // Only redirect if cache is fresh to avoid stale redirects
    const status = getCachedStatus()
    if (status?.register_enabled === false) {
      throw redirect({ to: '/sign-in' })
    }
  },
})
