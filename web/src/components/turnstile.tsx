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
import { useEffect, useRef } from 'react'

const TURNSTILE_SCRIPT_ID = 'cf-turnstile'
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
// Avoid leaving protected form actions disabled forever when the script load
// never settles, while allowing slow networks a conservative grace period.
const TURNSTILE_LOAD_TIMEOUT_MS = 15_000

export type TurnstileStatus = 'loading' | 'verified' | 'error' | 'expired'

export type TurnstileErrorCode =
  | 'script-load-failed'
  | 'script-timeout'
  | 'render-failed'
  | 'challenge-failed'

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: Record<string, unknown>
  ) => string | number | undefined
  remove?: (widgetId: string | number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

interface TurnstileLoadError extends Error {
  code: Extract<TurnstileErrorCode, 'script-load-failed' | 'script-timeout'>
}

let turnstileLoader: Promise<TurnstileApi> | undefined

function createTurnstileLoadError(
  code: TurnstileLoadError['code']
): TurnstileLoadError {
  const error = new Error(
    'Turnstile script could not be loaded'
  ) as TurnstileLoadError
  error.code = code
  return error
}

/**
 * Load the Turnstile script once for all mounted widgets. A script element may
 * already exist while another component is still loading it, so all callers
 * share the same promise instead of returning early and leaving a blank widget.
 */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  if (turnstileLoader) {
    return turnstileLoader
  }

  const promise = new Promise<TurnstileApi>((resolve, reject) => {
    let script = document.querySelector(
      `#${TURNSTILE_SCRIPT_ID}`
    ) as HTMLScriptElement | null
    const shouldAppendScript = !script
    let settled = false

    const cleanup = () => {
      script?.removeEventListener('load', handleLoad)
      script?.removeEventListener('error', handleError)
      window.clearTimeout(timeoutId)
    }

    const fail = (code: TurnstileLoadError['code']) => {
      if (settled) return
      settled = true
      cleanup()
      if (script?.parentElement) {
        script.remove()
      }
      reject(createTurnstileLoadError(code))
    }

    const handleLoad = () => {
      if (window.turnstile) {
        settled = true
        cleanup()
        resolve(window.turnstile)
        return
      }
      fail('script-load-failed')
    }

    const handleError = () => fail('script-load-failed')

    const timeoutId = window.setTimeout(
      () => fail('script-timeout'),
      TURNSTILE_LOAD_TIMEOUT_MS
    )

    if (!script) {
      script = document.createElement('script')
      script.id = TURNSTILE_SCRIPT_ID
      script.src = TURNSTILE_SCRIPT_SRC
      script.async = true
      script.defer = true
    }

    script.addEventListener('load', handleLoad)
    script.addEventListener('error', handleError)
    if (shouldAppendScript) {
      document.head.appendChild(script)
    }

    // The API can become available between the initial check and listener
    // registration. Resolve on the next microtask without waiting for an
    // event that may already have fired.
    void Promise.resolve()
      .then(() => {
        if (!settled && window.turnstile) {
          handleLoad()
        }
      })
      .catch(() => undefined)
  })

  turnstileLoader = promise
  void promise.then(
    () => {
      if (turnstileLoader === promise) turnstileLoader = undefined
    },
    () => {
      if (turnstileLoader === promise) turnstileLoader = undefined
    }
  )
  return promise
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onExpire?: () => void
  onError?: (errorCode: TurnstileErrorCode) => void
  onStatusChange?: (
    status: TurnstileStatus,
    errorCode?: TurnstileErrorCode
  ) => void
  className?: string
}

export function Turnstile(props: TurnstileProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const renderedWidgetRef = useRef<{
    api: TurnstileApi
    id: string | number
  } | null>(null)
  const onVerifyRef = useRef(props.onVerify)
  const onExpireRef = useRef(props.onExpire)
  const onErrorRef = useRef(props.onError)
  const onStatusChangeRef = useRef(props.onStatusChange)

  onVerifyRef.current = props.onVerify
  onExpireRef.current = props.onExpire
  onErrorRef.current = props.onError
  onStatusChangeRef.current = props.onStatusChange

  useEffect(() => {
    let cancelled = false
    const isActive = () => !cancelled
    const reportStatus = (
      status: TurnstileStatus,
      errorCode?: TurnstileErrorCode
    ) => {
      if (isActive()) {
        onStatusChangeRef.current?.(status, errorCode)
      }
    }

    reportStatus('loading')

    const renderWidget = (api: TurnstileApi) => {
      if (!isActive() || !ref.current || renderedWidgetRef.current) return

      try {
        const widgetId = api.render(ref.current, {
          sitekey: props.siteKey,
          callback: (token: string) => {
            if (!isActive()) return
            reportStatus('verified')
            onVerifyRef.current(token)
          },
          'error-callback': () => {
            if (!isActive()) return
            reportStatus('error', 'challenge-failed')
            onErrorRef.current?.('challenge-failed')
            // Preserve the old callback contract: callers used onExpire to
            // clear any token after a provider-side verification error too.
            onExpireRef.current?.()
          },
          'expired-callback': () => {
            if (!isActive()) return
            reportStatus('expired')
            onExpireRef.current?.()
          },
        })
        renderedWidgetRef.current = { api, id: widgetId ?? '' }
      } catch {
        reportStatus('error', 'render-failed')
        onErrorRef.current?.('render-failed')
      }
    }

    loadTurnstile()
      .then((api) => {
        renderWidget(api)
      })
      .catch((error: unknown) => {
        if (!isActive()) return
        const errorCode: TurnstileErrorCode =
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error.code === 'script-timeout' ||
            error.code === 'script-load-failed')
            ? error.code
            : 'script-load-failed'
        reportStatus('error', errorCode)
        onErrorRef.current?.(errorCode)
      })

    return () => {
      cancelled = true
      const widget = renderedWidgetRef.current
      if (widget?.api.remove && widget.id !== '') {
        widget.api.remove(widget.id)
      }
      renderedWidgetRef.current = null
    }
  }, [props.siteKey])

  return <div ref={ref} className={props.className} />
}
