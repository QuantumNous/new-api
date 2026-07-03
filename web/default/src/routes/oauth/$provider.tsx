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
import { useEffect, useState } from 'react'
import type { AxiosRequestConfig } from 'axios'
import {
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import i18next from 'i18next'
import { toast } from 'sonner'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { api, getSelf } from '@/lib/api'
import { getAdsAttributionPayload } from '@/lib/analytics/attribution'
import { trackAdsFunnelEvent, trackSignupConversion } from '@/lib/analytics/gtag'
import { trackPixelsSignup } from '@/lib/analytics/pixels'
import { identifyMixpanelUser, trackMixpanelEvent } from '@/lib/analytics/mixpanel'
import { trackYahooSignupConversion } from '@/lib/analytics/yahoo'
import { OAuthCallbackScreen } from '@/features/auth/components/oauth-callback-screen'
import { OAUTH_BIND_STORAGE_KEY } from '@/features/auth/constants'
import {
  isSafeInternalPath,
  readPendingPostLoginRedirect,
} from '@/features/auth/lib/storage'

type OAuthRequestConfig = AxiosRequestConfig & {
  skipBusinessError?: boolean
}

function OAuthCallback() {
  const navigate = useNavigate()
  const { provider } = useParams({ from: '/oauth/$provider' }) as {
    provider: string
  }
  const search = useSearch({ from: '/oauth/$provider' }) as {
    code?: string
    state?: string
    redirect?: string
  }
  const [mode, setMode] = useState<'login' | 'bind'>(() => {
    if (typeof window === 'undefined') return 'login'
    return window.opener ? 'bind' : 'login'
  })

  useEffect(() => {
    ;(async () => {
      const safeNavigate = (target: string) => {
        const parsed = new URL(target, window.location.origin)
        const search = parsed.search
          ? Object.fromEntries(parsed.searchParams)
          : undefined
        const hash = parsed.hash ? parsed.hash.slice(1) : undefined
        if (search || hash) {
          navigate({
            to: parsed.pathname as never,
            search: search as never,
            hash,
            replace: true,
          })
        } else {
          navigate({ to: parsed.pathname as never, replace: true })
        }
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const normalizedTarget = target.startsWith('/')
              ? target
              : `/${target}`
            const currentPath =
              window.location.pathname + window.location.search
            if (
              currentPath !== normalizedTarget &&
              currentPath !== `${normalizedTarget}/`
            ) {
              window.location.replace(target)
            }
          }, 100)
        }
      }

      if (!search?.code) {
        toast.error(i18next.t('Missing code'))
        safeNavigate('/sign-in')
        return
      }
      const isBindingFlow =
        typeof window !== 'undefined' ? Boolean(window.opener) : mode === 'bind'
      if (isBindingFlow && mode !== 'bind') {
        setMode('bind')
      } else if (!isBindingFlow && mode !== 'login') {
        setMode('login')
      }
      const notifyBindingResult = (status: 'success' | 'error') => {
        if (typeof window === 'undefined') return
        try {
          window.localStorage.setItem(
            OAUTH_BIND_STORAGE_KEY,
            JSON.stringify({
              provider,
              status,
              timestamp: Date.now(),
            })
          )
        } catch (_error) {
          // ignore storage write failures
          void _error
        }
      }

      const closeBindingWindow = () => {
        if (typeof window === 'undefined') return
        window.close()
        setTimeout(() => {
          if (!window.closed) {
            window.location.replace('/_authenticated/profile/')
          }
        }, 200)
      }

      const consumeSignupOAuthStart = () => {
        if (typeof window === 'undefined') return ''
        // Always consume both stores so a stale fallback entry can never be
        // replayed by a later (non-signup) OAuth callback within its TTL.
        let sessionProvider = ''
        try {
          sessionProvider =
            window.sessionStorage.getItem('ads:oauth_signup_start') || ''
          window.sessionStorage.removeItem('ads:oauth_signup_start')
        } catch {
          /* ignore storage failures */
        }
        let localRaw: string | null = null
        try {
          localRaw = window.localStorage.getItem('ads:oauth_signup_start')
          window.localStorage.removeItem('ads:oauth_signup_start')
        } catch {
          /* ignore storage failures */
        }
        if (sessionProvider) return sessionProvider
        if (!localRaw) return ''
        try {
          const parsed = JSON.parse(localRaw) as {
            provider?: string
            started_at?: number
          }
          const maxAgeMs = 30 * 60 * 1000
          if (
            parsed?.provider &&
            parsed?.started_at &&
            Date.now() - parsed.started_at <= maxAgeMs
          ) {
            return parsed.provider
          }
        } catch {
          /* ignore storage failures */
        }
        return ''
      }

      const trackOAuthResult = (result: 'success' | 'error', message?: string) => {
        const signupProvider = consumeSignupOAuthStart()
        trackAdsFunnelEvent(`flatkey_oauth_${result}`, {
          provider,
          mode: isBindingFlow ? 'bind' : 'login',
          started_from_signup: Boolean(signupProvider),
          reason: message,
        })
        if (result === 'success' && signupProvider && !isBindingFlow) {
          trackSignupConversion()
          trackPixelsSignup()
          trackAdsFunnelEvent('flatkey_signup_success', {
            method: 'oauth',
            provider,
          })
          trackMixpanelEvent('sign_up_completed', {
            sign_up_method: 'oauth',
            provider,
            platform: 'web',
            product_surface: 'console',
          })
        }
      }

      const finalizeLogin = async (): Promise<boolean> => {
        try {
          const selfResponse = (await getSelf()) as {
            success?: boolean
            data?: AuthUser | null
          }
          if (selfResponse?.success && selfResponse.data) {
            useAuthStore.getState().auth.setUser(selfResponse.data)
            identifyMixpanelUser(selfResponse.data)
            try {
              if (
                typeof window !== 'undefined' &&
                selfResponse.data?.id != null
              ) {
                window.localStorage.setItem('uid', String(selfResponse.data.id))
              }
            } catch (_error) {
              void _error
            }
            return true
          }
        } catch (_error) {
          void _error
        }
        return false
      }

      const redirectAfterLogin = (target?: string) => {
        // The provider round-trip strips our ?redirect= param from the callback URL, so the
        // value persisted at OAuth start is the reliable source for OAuth logins. Validate
        // every candidate (search.redirect is user-controllable) through isSafeInternalPath
        // so we never navigate to an external origin after authenticating (open-redirect).
        const stored = readPendingPostLoginRedirect()
        const requested = target || search?.redirect || stored
        const to = isSafeInternalPath(requested) ? requested : '/dashboard'
        safeNavigate(to)
        toast.success(i18next.t('Signed in successfully!'))
      }

      const handleBindingFailure = (message: string) => {
        trackOAuthResult('error', message)
        notifyBindingResult('error')
        toast.error(message)
      }

      const handleLoginFailure = async (message: string) => {
        if (await finalizeLogin()) {
          trackOAuthResult('success')
          redirectAfterLogin()
          return
        }
        trackOAuthResult('error', message)
        toast.error(message)
        safeNavigate('/sign-in')
      }

      try {
        const adsAttribution = getAdsAttributionPayload()
        const config: OAuthRequestConfig = {
          params: {
            code: search.code,
            state: search.state,
            // Pass the exact redirect_uri used in the authorize step so the
            // backend token exchange matches it even when the web frontend and
            // backend (ServerAddress) are on different domains.
            redirect_uri: `${window.location.origin}/oauth/${provider}`,
            ads_attribution: adsAttribution || undefined,
          },
          skipBusinessError: true,
        }
        const res = await api.get(`/api/oauth/${provider}`, config)
        if (res?.data?.success) {
          const { message } = res.data
          const loginUser = (res.data?.data ?? null) as AuthUser | null
          // Check if this is a bind operation
          if (message === 'bind') {
            trackOAuthResult('success')
            toast.success(i18next.t('Binding successful!'))
            notifyBindingResult('success')
            if (isBindingFlow) {
              // Close the callback window if we opened a new tab for binding
              closeBindingWindow()
            } else {
              safeNavigate('/_authenticated/profile/')
            }
            return
          }
          // Otherwise it's a login, use payload user if available
          if (loginUser) {
            // is_new_user is a one-shot signal for triggering onboarding below; strip it
            // before persisting so a hard refresh can't re-read a stale flag from storage.
            const isNewUser = loginUser.is_new_user === true
            const { is_new_user: _isNew, ...persistedUser } = loginUser
            void _isNew
            useAuthStore.getState().auth.setUser(persistedUser)
            try {
              if (typeof window !== 'undefined' && loginUser.id != null) {
                window.localStorage.setItem('uid', String(loginUser.id))
              }
            } catch (_error) {
              void _error
            }
            trackOAuthResult('success')
            // Brand-new standard OAuth registrations follow the same activation-first
            // contract as password sign-up: land in Playground first-run once, before
            // any card-bind/top-up prompt can compete for attention.
            if (isNewUser) {
              trackYahooSignupConversion()
              redirectAfterLogin('/playground?first=1')
              return
            }
            redirectAfterLogin()
            return
          }
          if (await finalizeLogin()) {
            trackOAuthResult('success')
            redirectAfterLogin()
            return
          }
          const failureMessage = res?.data?.message || i18next.t('OAuth failed')
          trackOAuthResult('error', failureMessage)
          toast.error(failureMessage)
          safeNavigate('/sign-in')
          return
        }
        const message = res?.data?.message || 'OAuth failed'
        if (!res?.data?.success && !isBindingFlow) {
          // When logging in with an already bound GitHub account, backend may return this message
          if (message === '该 GitHub 账户已被绑定') {
            if (await finalizeLogin()) {
              trackOAuthResult('success')
              redirectAfterLogin()
              return
            }
          }
        }
        if (isBindingFlow) {
          handleBindingFailure(message)
        } else {
          await handleLoginFailure(message)
        }
        return
      } catch (error) {
        const message = ((error &&
          typeof error === 'object' &&
          'response' in error &&
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message) ??
          (error instanceof Error ? error.message : undefined) ??
          'OAuth failed') as string

        if (isBindingFlow) {
          handleBindingFailure(message)
          return
        }
        await handleLoginFailure(message)
        return
      }
    })()
  }, [mode, navigate, provider, search])

  return <OAuthCallbackScreen provider={provider} mode={mode} />
}

export const Route = createFileRoute('/oauth/$provider')({
  component: OAuthCallback,
})
