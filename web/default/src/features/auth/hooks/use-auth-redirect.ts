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
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { getSelf } from '@/lib/api'
import type { User } from '@/features/users/types'
import {
  consumePendingOnboarding,
  isSafeInternalPath,
  saveUserId,
} from '../lib/storage'

function getSavedLanguage(user: User): string | undefined {
  const userData = user as Record<string, unknown>
  if (typeof userData.language === 'string') {
    return userData.language
  }

  if (typeof userData.setting !== 'string') {
    return undefined
  }

  try {
    const setting = JSON.parse(userData.setting) as { language?: unknown }
    return typeof setting.language === 'string' ? setting.language : undefined
  } catch {
    return undefined
  }
}

/**
 * Hook for handling authentication redirects and user data management
 */
export function useAuthRedirect() {
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  /**
   * Handle successful login
   * @param userData - Optional user data from login response
   * @param redirectTo - Redirect path after login
   */
  const handleLoginSuccess = async (
    userData?: { id?: number } | null,
    redirectTo?: string
  ) => {
    // Save user ID if available
    if (userData?.id) {
      saveUserId(userData.id)
    }

    // Fetch and set user data
    let freshUser: User | null = null
    try {
      const self = await getSelf()
      if (self?.success && self.data) {
        const user = self.data as User
        freshUser = user
        auth.setUser(user)

        // Update user ID if not already set
        if (user.id) {
          saveUserId(user.id)
        }

        // Restore saved language preference
        const savedLang = getSavedLanguage(user)
        if (savedLang && savedLang !== i18n.language) {
          i18n.changeLanguage(savedLang)
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    }

    // Always consume legacy onboarding so it can never leak into a later login.
    // New-user Playground first-run is now delivered by an explicit registration
    // target, so normal logins only honor safe redirects or the dashboard default.
    const pendingOnboarding = consumePendingOnboarding()

    // Navigate to target page. Existing redirect behavior and legacy
    // card-bind/top-up onboarding are unchanged for non-registration logins.
    // redirectTo originates from the ?redirect= URL param, so validate it as an internal
    // path before navigating to avoid an open-redirect. Treat an invalid redirect as "no
    // redirect" everywhere (not just for navigation) so it can't suppress the onboarding
    // dialog while silently consuming the pending-onboarding flag.
    const safeRedirectTo = isSafeInternalPath(redirectTo) ? redirectTo : undefined
    const targetPath = safeRedirectTo || '/dashboard'
    if (!safeRedirectTo && pendingOnboarding) {
      const cardBindEnabled =
        useSystemConfigStore.getState().config.enableStripeCardBind === true
      // Read the freshly fetched user (the closed-over auth.user is the pre-login
      // snapshot and would be null/stale on first login).
      const cardBound = freshUser?.stripe_card_bound === true
      if (cardBindEnabled && !cardBound) {
        useOnboardingStore.getState().openOnboarding()
      }
    }
    // targetPath may carry a query string and/or hash (e.g. '/playground?first=1'
    // for the post-registration first-run onboarding, or a nested redirect like
    // '/callback?redirect=/playground?first=1'). TanStack's navigate does NOT parse
    // a query/hash out of `to`, so parse with the URL API: it splits on the FIRST
    // '?' only — preserving any nested '?' inside a value — and isolates a trailing
    // '#hash'. Without a query/hash, behavior is identical to before.
    const parsed = new URL(targetPath, window.location.origin)
    const toSearch = parsed.search
      ? Object.fromEntries(parsed.searchParams)
      : undefined
    const toHash = parsed.hash ? parsed.hash.slice(1) : undefined
    if (toSearch || toHash) {
      navigate({
        to: parsed.pathname,
        search: toSearch,
        hash: toHash,
        replace: true,
      })
    } else {
      navigate({ to: parsed.pathname, replace: true })
    }
  }

  /**
   * Redirect to 2FA page
   */
  const redirectTo2FA = () => {
    navigate({ to: '/otp', replace: true })
  }

  /**
   * Redirect to login page, preserving an optional post-login destination so flows
   * like "Get API Key" (sign-up → sign-in → /keys) land on the intended tab.
   */
  const redirectToLogin = (redirectTo?: string) => {
    navigate({
      to: '/sign-in',
      search: redirectTo ? { redirect: redirectTo } : undefined,
      replace: true,
    })
  }

  /**
   * Redirect to register page
   */
  const redirectToRegister = () => {
    navigate({ to: '/sign-up', replace: true })
  }

  return {
    handleLoginSuccess,
    redirectTo2FA,
    redirectToLogin,
    redirectToRegister,
  }
}
