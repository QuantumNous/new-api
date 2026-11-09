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
import { useNavigate } from '@tanstack/react-router'
import i18n from 'i18next'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DASHBOARD_DEFAULT_SECTION } from '@/apps/client/features/dashboard/section-registry'
import {
  getSavedLanguage,
  sanitizeAuthRedirect,
} from '@/shared/features/auth/lib/auth-redirect'
import { changeInterfaceLanguage } from '@/shared/i18n/config'
import {
  applyAuthBundle,
  clearAuthentication,
  isAuthBundle,
} from '@/shared/lib/api'
import { isCrossOriginPortal, portalHref } from '@/shared/lib/portal-url'
import { ROLE } from '@/shared/lib/roles'
import { AuthOperationError } from '@/shared/lib/secure-verification'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import { logout } from '../api'
import { isLoginChallenge } from '../secure-verification/api'
import type { LoginGuard } from '../types'

/** Client landing page after a successful login. */
const CLIENT_HOME = `/app/workspace/${DASHBOARD_DEFAULT_SECTION}`

const ADMIN_HOME = '/admin/overview'

/**
 * Hook for handling authentication redirects and user data management
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  /**
   * Revoke a freshly issued session whose account lacks the required role.
   * The bundle is applied without tab synchronization first so the logout call
   * targets this exact session, and local state is cleared even if the server
   * request fails.
   */
  const rejectAuthenticatedSession = useCallback(
    async (bundle: AuthBundle, deniedMessage?: string) => {
      applyAuthBundle(bundle, false)
      try {
        await logout()
      } catch {
        // The local session is still discarded below; a denied account must
        // never keep portal access because the revocation request failed.
      } finally {
        clearAuthentication()
      }
      toast.error(
        deniedMessage ?? t('Access Denied: Administrator privileges required.')
      )
    },
    [t]
  )

  /**
   * Handle successful login
   * @param userData - Optional user data from login response
   * @param redirectTo - Redirect path after login
   * @param guard - Optional role requirement enforced before navigating
   * @returns Whether the user was routed to a portal
   */
  const handleLoginSuccess = useCallback(
    async (
      bundle: AuthBundle,
      redirectTo?: string,
      guard?: LoginGuard
    ): Promise<boolean> => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return false
      }

      const role = bundle.user.role ?? ROLE.GUEST
      if (guard?.requiredRole !== undefined && role < guard.requiredRole) {
        await rejectAuthenticatedSession(bundle, guard.deniedMessage)
        return false
      }

      applyAuthBundle(bundle)
      const savedLang = getSavedLanguage(bundle.user)
      if (savedLang && savedLang !== i18n.language) {
        await changeInterfaceLanguage(savedLang)
      }

      // Administrators continue in the admin portal, whichever form signed them in.
      if (role >= ROLE.ADMIN) {
        if (isCrossOriginPortal('admin')) {
          window.location.assign(portalHref('admin', ADMIN_HOME))
          return true
        }
        await navigate({ to: '/admin/overview', replace: true })
        return true
      }

      const targetPath =
        sanitizeAuthRedirect(redirectTo, window.location.origin) ?? CLIENT_HOME
      await navigate({ href: targetPath, replace: true })
      return true
    },
    [navigate, rejectAuthenticatedSession, sessionID]
  )

  /**
   * Every primary login transport returns the same bundle-or-challenge contract.
   */
  const handleLoginResult = useCallback(
    async (
      result: unknown,
      redirectTo?: string,
      guard?: LoginGuard
    ): Promise<boolean> => {
      if (
        !mounted.current ||
        useAuthStore.getState().auth.session?.sid !== sessionID
      ) {
        return false
      }
      if (isAuthBundle(result)) {
        return handleLoginSuccess(result, redirectTo, guard)
      }
      if (!isLoginChallenge(result)) {
        throw new AuthOperationError('Login failed')
      }
      if (result.expires_at * 1000 <= Date.now()) {
        throw new AuthOperationError(
          'Login flow expired. Please sign in again.'
        )
      }
      useAuthStore.getState().auth.setPendingLoginVerification({
        challenge: result,
        redirectTo:
          sanitizeAuthRedirect(redirectTo, window.location.origin) ?? undefined,
        requiredRole: guard?.requiredRole,
      })
      await navigate({ to: '/otp', replace: true })
      return false
    },
    [handleLoginSuccess, navigate, sessionID]
  )

  /**
   * Redirect to login page
   */
  const redirectToLogin = useCallback(() => {
    void navigate({ to: '/login', replace: true })
  }, [navigate])

  /**
   * Redirect to the admin login page
   */
  const redirectToAdminLogin = useCallback(() => {
    if (isCrossOriginPortal('admin')) {
      window.location.assign(portalHref('admin', '/admin/login'))
      return
    }
    void navigate({ to: '/admin/login', replace: true })
  }, [navigate])

  /**
   * Redirect to register page
   */
  const redirectToRegister = useCallback(() => {
    void navigate({ to: '/sign-up', replace: true })
  }, [navigate])

  return {
    handleLoginSuccess,
    handleLoginResult,
    redirectToLogin,
    redirectToAdminLogin,
    redirectToRegister,
  }
}
