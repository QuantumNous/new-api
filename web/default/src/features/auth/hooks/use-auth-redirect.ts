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
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/features/users/types'
import { bootstrapUserAfterLogin } from '../lib/bootstrap-user'
import {
  resolvePostLoginRedirect,
  type PostLoginRedirect,
} from '../lib/post-login-redirect'

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

async function navigatePostLogin(
  navigate: ReturnType<typeof useNavigate>,
  destination: PostLoginRedirect
) {
  if (destination.kind === 'dashboard') {
    await navigate({
      to: '/dashboard/$section',
      params: { section: destination.section },
      replace: true,
    })
    return
  }

  await navigate({ href: destination.pathname, replace: true })
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
   * @returns true when navigation completed
   */
  const handleLoginSuccess = async (
    userData?: { id?: number } | null,
    redirectTo?: string
  ): Promise<boolean> => {
    const user = await bootstrapUserAfterLogin(auth.setUser, userData)
    if (!user) {
      toast.error(i18n.t('Failed to load profile'))
      return false
    }

    const savedLang = getSavedLanguage(user)
    if (savedLang && savedLang !== i18n.language) {
      i18n.changeLanguage(savedLang)
    }

    const destination = resolvePostLoginRedirect(redirectTo)
    await navigatePostLogin(navigate, destination)
    return true
  }

  /**
   * Redirect to 2FA page
   */
  const redirectTo2FA = () => {
    navigate({ to: '/otp', replace: true })
  }

  /**
   * Redirect to login page
   */
  const redirectToLogin = () => {
    navigate({ to: '/sign-in', replace: true })
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
