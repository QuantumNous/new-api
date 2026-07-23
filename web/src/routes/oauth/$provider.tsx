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
import {
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import type { AxiosRequestConfig } from 'axios'
import i18next from 'i18next'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { completeOAuthRegistration } from '@/features/auth/api'
import { OAuthCallbackScreen } from '@/features/auth/components/oauth-callback-screen'
import {
  OAUTH_BIND_CALLBACK_MESSAGE,
  OAUTH_BIND_RESULT_MESSAGE,
} from '@/features/auth/constants'
import { sanitizeAuthRedirect } from '@/features/auth/lib/auth-redirect'
import {
  parseTelegramBindCallback,
  postTelegramBindResult,
  startOAuthBindResponseDeadline,
} from '@/features/auth/lib/oauth-bind-window'
import { api, applyAuthBundle, isAuthBundle } from '@/lib/api'
import { getServerErrorMessageKey } from '@/lib/server-error-message'

type OAuthRequestConfig = AxiosRequestConfig & {
  skipBusinessError?: boolean
}

interface OAuthBindingResult {
  type: typeof OAUTH_BIND_RESULT_MESSAGE
  provider: string
  state: string
  success: boolean
  message?: string
}

function OAuthCallback() {
  const navigate = useNavigate()
  const { provider } = useParams({ from: '/oauth/$provider' }) as {
    provider: string
  }
  const search = useSearch({ from: '/oauth/$provider' }) as {
    code?: string
    state?: string
    error?: string
    error_description?: string
    redirect?: string
    telegram_bind?: string
    flow_token?: string
    error_code?: string
  }
  const mode: 'login' | 'bind' =
    typeof window !== 'undefined' && window.opener ? 'bind' : 'login'
  // Held in memory only so the pending flow token never enters the URL/history.
  const [pendingFlowToken, setPendingFlowToken] = useState<string | null>(null)
  const [registrationCode, setRegistrationCode] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const code = search.code ?? ''
    const state = search.state ?? ''
    const telegramCallback =
      provider === 'telegram'
        ? parseTelegramBindCallback({
            telegram_bind: search.telegram_bind,
            flow_token: search.flow_token,
            error_code: search.error_code,
          })
        : null
    if (telegramCallback) {
      const opener = window.opener
      if (
        !postTelegramBindResult(
          telegramCallback,
          opener,
          window.location.origin
        )
      ) {
        toast.error(i18next.t('Telegram binding failed. Please try again.'))
        const closeTimeout = window.setTimeout(() => window.close(), 1500)
        return () => window.clearTimeout(closeTimeout)
      }
      window.close()
      return
    }

    if (mode === 'bind') {
      const opener = window.opener
      if (!opener || opener.closed) {
        toast.error(i18next.t('OAuth binding window is no longer available'))
        return
      }

      let cancelResultTimeout: () => void = () => undefined
      let delayedClose: number | undefined
      const handleBindingResult = (event: MessageEvent<unknown>) => {
        if (
          event.origin !== window.location.origin ||
          event.source !== opener
        ) {
          return
        }
        const result = event.data as Partial<OAuthBindingResult> | null
        if (
          !result ||
          result.type !== OAUTH_BIND_RESULT_MESSAGE ||
          result.provider !== provider ||
          result.state !== state
        ) {
          return
        }
        cancelResultTimeout()
        if (result.success) {
          toast.success(i18next.t('Binding successful!'))
          window.close()
          return
        }
        toast.error(result.message || i18next.t('OAuth failed'))
        delayedClose = window.setTimeout(() => window.close(), 1500)
      }

      window.addEventListener('message', handleBindingResult)
      cancelResultTimeout = startOAuthBindResponseDeadline(() => {
        toast.error(i18next.t('OAuth binding timed out. Please try again.'))
        delayedClose = window.setTimeout(() => window.close(), 1500)
      })
      opener.postMessage(
        {
          type: OAUTH_BIND_CALLBACK_MESSAGE,
          provider,
          code,
          state,
          error: search.error,
          errorDescription: search.error_description,
        },
        window.location.origin
      )
      return () => {
        window.removeEventListener('message', handleBindingResult)
        cancelResultTimeout()
        if (delayedClose !== undefined) window.clearTimeout(delayedClose)
      }
    }

    const safeNavigate = (target: unknown, fallback = '/dashboard') => {
      const href =
        sanitizeAuthRedirect(target, window.location.origin) ?? fallback
      void navigate({ href, replace: true })
    }

    if (!code && !search.error) {
      toast.error(i18next.t('Missing code'))
      safeNavigate('/sign-in', '/sign-in')
      return
    }

    void (async () => {
      try {
        const config: OAuthRequestConfig = {
          params: {
            code: code || undefined,
            state,
            error: search.error,
            error_description: search.error_description,
          },
          skipBusinessError: true,
        }
        const response = await api.get(`/api/oauth/${provider}`, config)
        if (response.data?.success && isAuthBundle(response.data?.data)) {
          applyAuthBundle(response.data.data)
          safeNavigate(search.redirect)
          toast.success(i18next.t('Signed in successfully!'))
          return
        }
        if (
          response.data?.data?.registration_code_required &&
          typeof response.data.data.flow_token === 'string'
        ) {
          setPendingFlowToken(response.data.data.flow_token)
          return
        }
        const messageKey = getServerErrorMessageKey(response.data)
        toast.error(
          messageKey
            ? i18next.t(messageKey)
            : response.data?.message || i18next.t('OAuth failed')
        )
      } catch (error: unknown) {
        const messageKey = getServerErrorMessageKey(error)
        const responseMessage = (
          error as { response?: { data?: { message?: string } } }
        ).response?.data?.message
        if (!messageKey) {
          toast.error(
            responseMessage ||
              (error instanceof Error
                ? error.message
                : i18next.t('OAuth failed'))
          )
        }
      }
      safeNavigate('/sign-in', '/sign-in')
    })()
  }, [
    mode,
    navigate,
    provider,
    search.code,
    search.error,
    search.error_code,
    search.error_description,
    search.flow_token,
    search.redirect,
    search.state,
    search.telegram_bind,
  ])

  async function handleCompleteRegistration() {
    if (!pendingFlowToken || !registrationCode.trim() || isCompleting) return
    setIsCompleting(true)
    try {
      const res = await completeOAuthRegistration({
        flow_token: pendingFlowToken,
        registration_code: registrationCode.trim(),
      })
      if (res?.success && isAuthBundle(res.data)) {
        applyAuthBundle(res.data)
        const href =
          sanitizeAuthRedirect(search.redirect, window.location.origin) ??
          '/dashboard'
        void navigate({ href, replace: true })
        toast.success(i18next.t('Signed in successfully!'))
        return
      }
      const messageKey = getServerErrorMessageKey(res)
      toast.error(
        messageKey
          ? i18next.t(messageKey)
          : res?.message || i18next.t('OAuth failed')
      )
    } catch (error: unknown) {
      const response = (
        error as {
          response?: { status?: number; data?: { message?: string } }
        }
      ).response
      if (response?.status === 403) {
        // The pending flow is invalid or expired; restart from sign-in.
        toast.error(response.data?.message || i18next.t('OAuth failed'))
        void navigate({ href: '/sign-in', replace: true })
        return
      }
      const messageKey = getServerErrorMessageKey(error)
      toast.error(
        messageKey
          ? i18next.t(messageKey)
          : response?.data?.message || i18next.t('OAuth failed')
      )
    } finally {
      setIsCompleting(false)
    }
  }

  if (pendingFlowToken) {
    return (
      <div className='flex min-h-svh items-center justify-center p-4'>
        <Card className='w-full max-w-sm'>
          <CardHeader>
            <CardTitle>{i18next.t('Registration code required')}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4'>
            <p className='text-muted-foreground text-sm'>
              {i18next.t(
                'This site requires a registration code to create a new account. Enter it to finish signing up.'
              )}
            </p>
            <div className='grid gap-2'>
              <Label htmlFor='oauth-registration-code'>
                {i18next.t('Registration code')}
              </Label>
              <Input
                id='oauth-registration-code'
                placeholder={i18next.t('Enter the registration code')}
                value={registrationCode}
                onChange={(event) => setRegistrationCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleCompleteRegistration()
                }}
                autoFocus
              />
            </div>
            <Button
              className='w-full justify-center gap-2'
              disabled={isCompleting || !registrationCode.trim()}
              onClick={() => void handleCompleteRegistration()}
            >
              {isCompleting ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : null}
              {i18next.t('Complete registration')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <OAuthCallbackScreen provider={provider} mode={mode} />
}

export const Route = createFileRoute('/oauth/$provider')({
  component: OAuthCallback,
})
