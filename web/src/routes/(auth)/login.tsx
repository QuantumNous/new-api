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

import { DASHBOARD_DEFAULT_SECTION } from '@/apps/client/features/dashboard/section-registry'
import { sanitizeAuthRedirect } from '@/shared/features/auth/lib/auth-redirect'
import { clearStaleLoginState } from '@/shared/features/auth/lib/login-recovery'
import { SignIn } from '@/shared/features/auth/sign-in'
import { LoginRecoveryBoundary } from '@/shared/features/auth/sign-in/login-recovery-boundary'
import { LoginError } from '@/shared/features/errors/login-error'
import { resolveAuthentication } from '@/shared/lib/auth-session'
import { isCrossOriginPortal, portalHref } from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'

/**
 * Coerce a search value to an optional string.
 *
 * Search params are user-controlled: repeated keys arrive as arrays and
 * malformed payloads can be objects. Rejecting those would fail the whole
 * route and show an error screen, so every unusable value degrades to
 * `undefined` instead.
 */
const optionalSearchString = z.preprocess((value) => {
  const candidate = Array.isArray(value) ? value[0] : value
  if (candidate === undefined || candidate === null) return undefined
  if (typeof candidate === 'string') return candidate
  if (typeof candidate === 'number' || typeof candidate === 'boolean') {
    return String(candidate)
  }
  return undefined
}, z.string().optional())

const searchSchema = z.object({
  redirect: optionalSearchString,
  // Set by the sign-up success path, which hands off with a full document
  // load so the login page can show the confirmation toast exactly once.
  registered: optionalSearchString,
})

function LoginScreen() {
  return (
    <LoginRecoveryBoundary>
      <SignIn />
    </LoginRecoveryBoundary>
  )
}

/** Session checks are already bounded by the refresh client's timeout; this
 *  extra bound makes sure a lock or stalled proxy can never leave the login
 *  transition pending with the URL changed but the old screen still mounted. */
const SESSION_RESOLVE_TIMEOUT_MS = 10_000

export const Route = createFileRoute('/(auth)/login')({
  component: LoginScreen,
  errorComponent: LoginError,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    // 根 guard 可能因为没有会话提示而跳过了 refresh。此处必须回源确认，
    // 否则持有有效 Refresh Cookie 的用户会被要求重新输入密码。
    let sessionTimer: ReturnType<typeof globalThis.setTimeout> | undefined
    let outcome: Awaited<ReturnType<typeof resolveAuthentication>> | undefined
    try {
      outcome = await Promise.race([
        resolveAuthentication(),
        new Promise<never>((_, reject) => {
          sessionTimer = globalThis.setTimeout(
            () => reject(new Error('Session resolution timed out')),
            SESSION_RESOLVE_TIMEOUT_MS
          )
        }),
      ])
    } catch {
      // A stalled session check must not pin the login transition; fall through
      // and render the form for an anonymous visitor.
    } finally {
      globalThis.clearTimeout(sessionTimer)
    }

    // Only a positively resolved session may leave the login page. Bouncing on
    // an unresolved state (transient refresh failure, timeout) would ping-pong
    // with the /app route guard, which sends that same unresolved session back
    // here.
    if (outcome?.kind !== 'authenticated') {
      // No confirmed session: any local auth data belongs to an expired or
      // corrupt login. Drop it before the form mounts so the page starts from
      // a clean, empty state instead of crashing on stale values.
      clearStaleLoginState()
      return
    }

    const { auth } = useAuthStore.getState()
    if (!auth.user) {
      clearStaleLoginState()
      return
    }

    // Administrators sign in through the admin portal.
    if (auth.user.role >= ROLE.ADMIN) {
      if (isCrossOriginPortal('admin')) {
        throw redirect({ href: portalHref('admin', '/admin/overview') })
      }
      throw redirect({ to: '/admin/overview', replace: true })
    }

    const target = sanitizeAuthRedirect(
      search?.redirect,
      window.location.origin
    )
    if (target) {
      throw redirect({ href: target, replace: true })
    }

    throw redirect({
      to: '/app/workspace/$section',
      params: { section: DASHBOARD_DEFAULT_SECTION },
      replace: true,
    })
  },
})
