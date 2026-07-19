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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>
      ) => string | undefined
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: () => void
  className?: string
}

const SCRIPT_ID = 'cf-turnstile'
const SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('no window'))
  }
  if (window.turnstile) {
    return Promise.resolve()
  }

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error('turnstile script failed')),
        { once: true }
      )
      // Script may already be loaded but turnstile not yet attached
      let tries = 0
      const timer = window.setInterval(() => {
        tries += 1
        if (window.turnstile) {
          window.clearInterval(timer)
          resolve()
        } else if (tries > 40) {
          window.clearInterval(timer)
          reject(new Error('turnstile script timeout'))
        }
      }, 50)
    })
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile script failed'))
    document.head.appendChild(s)
  })
}

export function Turnstile({
  siteKey,
  onVerify,
  onExpire,
  onError,
  className,
}: TurnstileProps) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const mount = async () => {
      setError(null)
      if (!siteKey) {
        setError(t('Turnstile site key is missing'))
        onError?.()
        return
      }
      if (!ref.current) return

      try {
        await loadTurnstileScript()
        if (cancelled || !ref.current || !window.turnstile) return

        // Clear previous widget in this container
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            /* empty */
          }
          widgetIdRef.current = undefined
        }
        ref.current.innerHTML = ''

        const id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            setError(null)
            onVerify(token)
          },
          'error-callback': () => {
            setError(
              t(
                'Turnstile failed to load. Check that this domain is allowed in Cloudflare Turnstile hostnames.'
              )
            )
            onExpire?.()
            onError?.()
          },
          'expired-callback': () => {
            onExpire?.()
          },
        })
        widgetIdRef.current = typeof id === 'string' ? id : undefined
      } catch {
        if (!cancelled) {
          setError(
            t(
              'Turnstile script could not be loaded. Check network / ad blockers.'
            )
          )
          onError?.()
        }
      }
    }

    void mount()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch {
          /* empty */
        }
        widgetIdRef.current = undefined
      }
    }
    // intentionally not depending on callbacks to avoid remount loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, t])

  return (
    <div className={cn('space-y-2', className)}>
      <div ref={ref} />
      {error ? (
        <p className='text-destructive text-xs leading-relaxed'>{error}</p>
      ) : null}
    </div>
  )
}
