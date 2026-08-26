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
import { useEffect } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { getSelf } from '@/lib/api'
import { wechatLoginByCode } from '@/features/auth/api'
import { DEFAULT_POST_LOGIN_PATH } from '@/features/auth/constants'
import { isSafeInternalPath } from '@/features/auth/lib/storage'

type WeChatOAuthTargetOptions = {
  /** Retained for compatibility; the default destination no longer varies by account age. */
  isNewUser?: boolean
  redirect?: string
}

export function getPostWechatLoginTarget(
  options: WeChatOAuthTargetOptions
): string {
  return isSafeInternalPath(options.redirect)
    ? options.redirect
    : DEFAULT_POST_LOGIN_PATH
}

function OAuthComponent() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/oauth' }) as {
    redirect?: string
    provider?: 'github' | 'discord' | 'oidc' | 'linuxdo' | 'telegram' | 'wechat'
    code?: string
    state?: string
  }

  useEffect(() => {
    ;(async () => {
      try {
        if (search?.provider === 'wechat' && search.code) {
          await wechatLoginByCode(search.code)
        }
        const res = await getSelf()
        if (res?.success) {
          useAuthStore.getState().auth.setUser(res.data as AuthUser)
          const target = getPostWechatLoginTarget({
            redirect: search?.redirect,
          })
          const parsed = new URL(target, window.location.origin)
          if (parsed.search || parsed.hash) {
            navigate({
              to: parsed.pathname,
              search: Object.fromEntries(parsed.searchParams),
              hash: parsed.hash ? parsed.hash.slice(1) : undefined,
              replace: true,
            })
          } else {
            navigate({ to: parsed.pathname, replace: true })
          }
          return
        }
      } catch {
        /* empty */
      }
      toast.error(i18next.t('OAuth failed'))
      navigate({ to: '/sign-in', replace: true })
    })()
  }, [navigate, search])

  return null
}

export const Route = createFileRoute('/(auth)/oauth')({
  component: OAuthComponent,
})
