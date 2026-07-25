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
import { useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'
import { api } from '@/lib/api'
import { getOAuthState } from '../api'
import {
  buildGitHubOAuthUrl,
  buildDiscordOAuthUrl,
  buildGoogleOAuthUrl,
  buildOIDCOAuthUrl,
  buildLinuxDOOAuthUrl,
} from '../lib/oauth'
import {
  clearPendingPostLoginRedirect,
  preparePendingPostLoginRedirectForOAuth,
} from '../lib/storage'
import type { SystemStatus, CustomOAuthProviderInfo } from '../types'

type LogoutRequestConfig = AxiosRequestConfig & {
  skipErrorHandler?: boolean
  preservePendingPostLoginRedirectOn401?: boolean
}

export async function runOAuthRedirectPreflight(
  resetSession: () => Promise<void>,
  getState: () => Promise<string | null>,
  buildURL: (state: string) => string
): Promise<string | null> {
  return runOAuthRedirectPreflightUntil(resetSession, getState, buildURL)
}

export class OAuthRedirectPreflightTimeoutError extends Error {
  constructor() {
    super('OAuth redirect preflight timed out')
    this.name = 'OAuthRedirectPreflightTimeoutError'
  }
}

export async function runOAuthRedirectPreflightWithTimeout(
  resetSession: () => Promise<void>,
  getState: () => Promise<string | null>,
  buildURL: (state: string) => string,
  timeoutMs: number
): Promise<string | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new OAuthRedirectPreflightTimeoutError()),
      timeoutMs
    )
  })

  try {
    return await runOAuthRedirectPreflightUntil(
      resetSession,
      getState,
      buildURL,
      deadline
    )
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

async function runOAuthRedirectPreflightUntil(
  resetSession: () => Promise<void>,
  getState: () => Promise<string | null>,
  buildURL: (state: string) => string,
  deadline?: Promise<never>
): Promise<string | null> {
  const waitFor = <T>(operation: Promise<T>) =>
    deadline ? Promise.race([operation, deadline]) : operation

  try {
    await waitFor(resetSession())
    const state = await waitFor(getState())
    if (!state) {
      clearPendingPostLoginRedirect()
      return null
    }
    return buildURL(state)
  } catch (error) {
    clearPendingPostLoginRedirect()
    throw error
  }
}

function trackOAuthStart(provider: string) {
  const path = window.location.pathname
  // OAuth providers redirect back to a fixed redirect_uri (/oauth/<provider>) that can't
  // carry our ?redirect=... intent param, so persist it (tab-scoped) at start and read it
  // back in the callback. Pass the current value through every time so a stale entry from
  // an earlier, abandoned attempt is cleared when this login has no redirect intent.
  try {
    const search = new URLSearchParams(window.location.search)
    const visibleRedirect = search.get('redirect')
    const recallRedirectNonce = search.get('recall_redirect')
    preparePendingPostLoginRedirectForOAuth(
      visibleRedirect,
      recallRedirectNonce
    )
  } catch {
    /* ignore storage failures */
  }
  if (path === '/sign-up' || path === '/sign-up/') {
    try {
      window.sessionStorage.setItem('ads:oauth_signup_start', provider)
      window.localStorage.setItem(
        'ads:oauth_signup_start',
        JSON.stringify({
          provider,
          started_at: Date.now(),
        })
      )
    } catch {
      /* ignore storage failures */
    }
  }
  trackAdsFunnelEvent('flatkey_oauth_start', {
    provider,
    path,
  })
}

/**
 * Hook for managing OAuth login
 */
export function useOAuthLogin(status: SystemStatus | null) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [githubButtonText, setGithubButtonText] = useState(() =>
    t('Continue with GitHub')
  )
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false)
  const { auth } = useAuthStore()

  const resetSession = async () => {
    try {
      auth.reset({ preservePendingPostLoginRedirect: true })
    } catch (_error) {
      // ignore store reset errors
    }
    try {
      await api.get('/api/user/logout', {
        skipErrorHandler: true,
        preservePendingPostLoginRedirectOn401: true,
      } as LogoutRequestConfig)
    } catch (_error) {
      // ignore logout errors
    }
  }

  const handleGitHubLogin = async () => {
    if (!status?.github_client_id) return
    if (githubButtonDisabled) return
    trackOAuthStart('github')

    setIsLoading(true)
    setGithubButtonDisabled(true)
    setGithubButtonText(t('Redirecting to GitHub...'))

    try {
      const url = await runOAuthRedirectPreflightWithTimeout(
        resetSession,
        getOAuthState,
        (state) => buildGitHubOAuthUrl(status.github_client_id!, state),
        20000
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        setIsLoading(false)
        setGithubButtonText(t('Continue with GitHub'))
        setGithubButtonDisabled(false)
        return
      }

      window.open(url, '_self')
    } catch (error) {
      clearPendingPostLoginRedirect()
      if (error instanceof OAuthRedirectPreflightTimeoutError) {
        setIsLoading(false)
        setGithubButtonText(
          t('Request timed out, please refresh and restart GitHub login')
        )
        setGithubButtonDisabled(true)
        return
      }
      toast.error(t('Failed to start GitHub login'))
      setIsLoading(false)
      setGithubButtonText(t('Continue with GitHub'))
      setGithubButtonDisabled(false)
    }
  }

  const handleDiscordLogin = async () => {
    if (!status?.discord_client_id) return
    trackOAuthStart('discord')

    setIsLoading(true)
    try {
      const url = await runOAuthRedirectPreflight(
        resetSession,
        getOAuthState,
        (state) => buildDiscordOAuthUrl(status.discord_client_id!, state)
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        return
      }

      window.open(url, '_self')
    } catch (_error) {
      clearPendingPostLoginRedirect()
      toast.error(t('Failed to start Discord login'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    if (!status?.google_client_id) return
    trackOAuthStart('google')

    setIsLoading(true)
    try {
      const url = await runOAuthRedirectPreflight(
        resetSession,
        getOAuthState,
        (state) => buildGoogleOAuthUrl(status.google_client_id!, state)
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        return
      }

      window.open(url, '_self')
    } catch (_error) {
      clearPendingPostLoginRedirect()
      toast.error(t('Failed to start Google login'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOIDCLogin = async () => {
    if (!status?.oidc_authorization_endpoint || !status?.oidc_client_id) return
    trackOAuthStart('oidc')

    setIsLoading(true)
    try {
      const url = await runOAuthRedirectPreflight(
        resetSession,
        getOAuthState,
        (state) =>
          buildOIDCOAuthUrl(
            status.oidc_authorization_endpoint!,
            status.oidc_client_id!,
            state
          )
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        return
      }

      window.open(url, '_self')
    } catch (_error) {
      clearPendingPostLoginRedirect()
      toast.error(t('Failed to start OIDC login'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinuxDOLogin = async () => {
    if (!status?.linuxdo_client_id) return
    trackOAuthStart('linuxdo')

    setIsLoading(true)
    try {
      const url = await runOAuthRedirectPreflight(
        resetSession,
        getOAuthState,
        (state) => buildLinuxDOOAuthUrl(status.linuxdo_client_id!, state)
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        return
      }

      window.open(url, '_self')
    } catch (_error) {
      clearPendingPostLoginRedirect()
      toast.error(t('Failed to start LinuxDO login'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleTelegramLogin = () => {
    toast.info(t('Telegram login requires widget integration; coming soon'))
  }

  const handleCustomOAuthLogin = async (provider: CustomOAuthProviderInfo) => {
    if (!provider.authorization_endpoint || !provider.client_id) return
    trackOAuthStart(provider.slug)

    setIsLoading(true)
    try {
      const url = await runOAuthRedirectPreflight(
        resetSession,
        getOAuthState,
        (state) => {
          const redirectUri = `${window.location.origin}/oauth/${provider.slug}`
          const providerURL = new URL(provider.authorization_endpoint)
          providerURL.searchParams.set('client_id', provider.client_id)
          providerURL.searchParams.set('redirect_uri', redirectUri)
          providerURL.searchParams.set('response_type', 'code')
          providerURL.searchParams.set('state', state)
          if (provider.scopes) {
            providerURL.searchParams.set('scope', provider.scopes)
          }
          return providerURL.toString()
        }
      )
      if (!url) {
        toast.error(t('Failed to initialize OAuth'))
        return
      }

      window.open(url, '_self')
    } catch (_error) {
      clearPendingPostLoginRedirect()
      toast.error(
        t('Failed to start {{provider}} login', { provider: provider.name })
      )
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    githubButtonText,
    githubButtonDisabled,
    handleGitHubLogin,
    handleDiscordLogin,
    handleGoogleLogin,
    handleOIDCLogin,
    handleLinuxDOLogin,
    handleTelegramLogin,
    handleCustomOAuthLogin,
  }
}
