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
import { ArrowUpRight, CircleAlert, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { resolveAuthentication } from '@/lib/auth-session'
import { useAuthStore } from '@/stores/auth-store'

import {
  DesktopConnectIssueError,
  issueDesktopConnectCode,
} from './api'
import {
  buildConnectDeepLink,
  buildSignInUrlForConnect,
  DEFAULT_DESKTOP_DOWNLOAD_URL,
  pageHttpsOrigin,
  shouldAutoConnect,
} from './lib/connect'

type ConnectPhase =
  | 'checking'
  | 'need_login'
  | 'ready'
  | 'issuing'
  | 'opening'
  | 'error'

export type DesktopConnectPageProps = {
  auto?: string | boolean | number
  /** Test seam: skip live auth resolve. */
  initialSignedIn?: boolean
}

export function DesktopConnectPage({
  auto,
  initialSignedIn,
}: DesktopConnectPageProps) {
  const { t } = useTranslation()
  const accessToken = useAuthStore((state) => state.auth.accessToken)
  const user = useAuthStore((state) => state.auth.user)
  const storeSignedIn = Boolean(accessToken && user)

  const [phase, setPhase] = useState<ConnectPhase>(() => {
    if (initialSignedIn === undefined) return 'checking'
    return initialSignedIn ? 'ready' : 'need_login'
  })
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const autoStarted = useRef(false)
  const searchForRedirect =
    typeof window !== 'undefined' ? window.location.search : ''

  const markNeedLogin = useCallback(() => {
    setPhase('need_login')
    setIsError(true)
    setStatusMessage(
      t('Sign in on this site before connecting the desktop app.')
    )
  }, [t])

  const markReady = useCallback(() => {
    setPhase('ready')
    setIsError(false)
    setStatusMessage('')
  }, [])

  useEffect(() => {
    if (initialSignedIn !== undefined) return
    let cancelled = false
    void (async () => {
      await resolveAuthentication()
      if (cancelled) return
      const auth = useAuthStore.getState().auth
      if (auth.accessToken && auth.user) {
        markReady()
      } else {
        markNeedLogin()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialSignedIn, markNeedLogin, markReady])

  useEffect(() => {
    if (initialSignedIn !== undefined) return
    if (phase === 'checking' || phase === 'issuing' || phase === 'opening') {
      return
    }
    if (storeSignedIn && phase === 'need_login') {
      markReady()
    } else if (!storeSignedIn && phase === 'ready') {
      markNeedLogin()
    }
  }, [
    initialSignedIn,
    markNeedLogin,
    markReady,
    phase,
    storeSignedIn,
  ])

  const openDesktop = useCallback(async () => {
    if (phase === 'issuing' || phase === 'opening') return

    const origin = pageHttpsOrigin(window.location)
    if (!origin) {
      setPhase('error')
      setIsError(true)
      setStatusMessage(t('This page must be served over HTTPS.'))
      return
    }

    setPhase('issuing')
    setIsError(false)
    setStatusMessage(t('Requesting connection…'))

    try {
      const issued = await issueDesktopConnectCode(origin)
      const deepLink = buildConnectDeepLink(issued.origin, issued.code)
      setPhase('opening')
      setStatusMessage(t('Opening the desktop app…'))

      const fallbackTimer = window.setTimeout(() => {
        window.location.assign(DEFAULT_DESKTOP_DOWNLOAD_URL)
      }, 2000)
      const onBlur = () => {
        window.clearTimeout(fallbackTimer)
        window.removeEventListener('blur', onBlur)
      }
      window.addEventListener('blur', onBlur)
      window.location.href = deepLink
    } catch (error) {
      const reason =
        error instanceof DesktopConnectIssueError
          ? error.reasonCode
          : 'issue_failed'
      if (reason === 'session_required') {
        markNeedLogin()
        return
      }
      setPhase('error')
      setIsError(true)
      const messageByReason: Record<string, string> = {
        connect_origin_not_https: t('This page must be served over HTTPS.'),
        issue_failed: t('Could not connect right now. Try again shortly.'),
        temporarily_unavailable: t(
          'Could not connect right now. Try again shortly.'
        ),
      }
      setStatusMessage(
        messageByReason[reason] ??
          t('Connection did not finish. Try again.')
      )
    }
  }, [markNeedLogin, phase, t])

  useEffect(() => {
    if (autoStarted.current) return
    if (phase !== 'ready') return
    if (!shouldAutoConnect({ auto })) return
    autoStarted.current = true
    void openDesktop()
  }, [auto, openDesktop, phase])

  const goSignIn = () => {
    window.location.assign(buildSignInUrlForConnect(searchForRedirect))
  }

  const primaryDisabled =
    phase === 'checking' || phase === 'issuing' || phase === 'opening'

  let buttonLabel = t('Open YesChoy desktop')
  if (phase === 'need_login') buttonLabel = t('Sign in')
  else if (phase === 'issuing') buttonLabel = t('Requesting connection…')
  else if (phase === 'opening') buttonLabel = t('Opening the desktop app…')

  return (
    <div className='bg-background text-foreground flex min-h-dvh items-center justify-center px-4 py-8'>
      <main className='border-border bg-card w-full max-w-[420px] rounded-2xl border p-6 shadow-lg sm:p-7'>
        <div
          className='bg-primary/10 text-primary mb-4 flex size-11 items-center justify-center rounded-xl'
          aria-hidden='true'
        >
          <ArrowUpRight className='size-5' />
        </div>
        <h1 className='text-xl font-semibold tracking-tight'>
          {t('Connect desktop assistant')}
        </h1>
        <p className='text-muted-foreground mt-2 text-sm leading-6'>
          {t(
            'Sign in on this site if you have not already, then use the button below. Your browser will open the YesChoy desktop app — no API keys to copy.'
          )}
        </p>

        <Button
          type='button'
          size='lg'
          className='mt-6 h-12 w-full rounded-xl text-base font-semibold'
          disabled={primaryDisabled}
          onClick={() => {
            if (phase === 'need_login') {
              goSignIn()
              return
            }
            void openDesktop()
          }}
        >
          {(phase === 'issuing' || phase === 'opening' || phase === 'checking') && (
            <LoaderCircle className='size-4 animate-spin' aria-hidden='true' />
          )}
          {buttonLabel}
        </Button>

        <p
          className={`mt-3 min-h-5 text-sm leading-5 ${
            isError ? 'text-destructive' : 'text-muted-foreground'
          }`}
          role='status'
          aria-live='polite'
        >
          {phase === 'checking'
            ? t('Checking whether you are signed in…')
            : statusMessage}
        </p>

        {isError && phase === 'error' ? (
          <p className='text-muted-foreground mt-2 flex items-start gap-2 text-xs leading-5'>
            <CircleAlert className='mt-0.5 size-3.5 shrink-0' aria-hidden />
            {t('You can try the button again after a moment.')}
          </p>
        ) : null}

        <footer className='border-border text-muted-foreground mt-6 border-t pt-4 text-center text-xs'>
          <span>{t('No desktop app?')} </span>
          <a
            className='underline underline-offset-2'
            href={DEFAULT_DESKTOP_DOWNLOAD_URL}
          >
            {t('Download')}
          </a>
        </footer>
      </main>
    </div>
  )
}
