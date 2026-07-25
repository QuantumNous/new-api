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
import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import {
  consumePendingPostLoginRedirect,
  isSafeInternalPath,
  protectRecallClaimOnAuthRoute,
  resolvePendingPostLoginRedirect,
} from '@/features/auth/lib/storage'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
  recall_redirect: z.string().min(1).max(128).optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  component: SignIn,
  validateSearch: searchSchema,
  beforeLoad: async ({ location, search }) => {
    const sanitizedHref = protectRecallClaimOnAuthRoute(location.href)
    if (sanitizedHref) {
      throw redirect({ href: sanitizedHref, replace: true })
    }

    const { auth } = useAuthStore.getState()

    // 如果已经有用户信息，说明已登录
    if (auth.user) {
      // 优先使用 redirect 参数（用户之前想去的地方），否则跳转到 dashboard。
      // redirect 来自 URL，必须校验为站内路径，避免开放重定向。
      const postLoginRedirect = resolvePendingPostLoginRedirect(
        search?.redirect,
        search?.recall_redirect
      )
      consumePendingPostLoginRedirect(search?.recall_redirect)
      throw redirect({
        to: isSafeInternalPath(postLoginRedirect)
          ? postLoginRedirect
          : '/dashboard',
      })
    }
  },
})
