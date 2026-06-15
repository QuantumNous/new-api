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

/**
 * Lightweight Google Ads / GA4 conversion tracking helper.
 *
 * Zero-dependency, opt-in by env var. When `VITE_GADS_CONVERSION_ID` is not
 * set at build time, every export here becomes a no-op, so deployments without
 * a Google Ads account are unaffected.
 *
 * Env vars (all optional, prefix VITE_ so Rsbuild exposes them to the client):
 *   VITE_GADS_CONVERSION_ID    e.g. "AW-10868031754" — gtag.js account id
 *   VITE_GADS_SIGNUP_SEND_TO   e.g. "AW-10867983435/GDIeCPiYtLgcEMuIob4o"
 *                              — full send_to for the signup conversion
 *   VITE_GADS_TOPUP_SEND_TO    e.g. "AW-10867983435/dRnJCMP0vb4cEMuIob4o"
 *                              — full send_to for the top-up (purchase) conversion
 */

type GtagFn = (...args: unknown[]) => void

type GtagEventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: GtagFn
  }
}

const CONVERSION_ID = import.meta.env.VITE_GADS_CONVERSION_ID as
  | string
  | undefined
// Full send_to value for the signup conversion, e.g. "AW-123456789/AbCdEfg".
// Kept as a complete value (not assembled from CONVERSION_ID) because the
// conversion's AW prefix can differ from the gtag account id loaded above.
const SIGNUP_SEND_TO = import.meta.env.VITE_GADS_SIGNUP_SEND_TO as
  | string
  | undefined
// Full send_to for the top-up (purchase) conversion. Same AW account as signup,
// different label — kept as a complete value for the same reason as SIGNUP_SEND_TO.
const TOPUP_SEND_TO = import.meta.env.VITE_GADS_TOPUP_SEND_TO as
  | string
  | undefined
const GA_MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ||
  'G-30RCEP2CVH'

let loaderPromise: Promise<void> | null = null

/** Whether tracking is enabled (a conversion id was provided at build time). */
export function isGtagEnabled(): boolean {
  return Boolean(CONVERSION_ID)
}

/**
 * Lazily inject gtag.js exactly once. Safe to call repeatedly.
 * Resolves immediately (and as a no-op) when tracking is disabled or when
 * running outside the browser.
 */
export function ensureGtagLoaded(): Promise<void> {
  if (!CONVERSION_ID || typeof window === 'undefined') {
    return Promise.resolve()
  }
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<void>((resolve) => {
    window.dataLayer = window.dataLayer || []
    const gtag: GtagFn = function gtag() {
      // gtag relies on `arguments` being pushed verbatim.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments)
    }
    window.gtag = window.gtag || gtag
    window.gtag('js', new Date())
    window.gtag('config', CONVERSION_ID)

    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${CONVERSION_ID}`
    script.onload = () => resolve()
    script.onerror = () => resolve() // never block UX on a blocked tracker
    document.head.appendChild(script)
  })

  return loaderPromise
}

/**
 * Fire the "sign up" conversion. No-op unless both the gtag account id and the
 * signup send_to are configured. Best-effort: failures never throw.
 */
export function trackSignupConversion(): void {
  if (!CONVERSION_ID || !SIGNUP_SEND_TO) return
  void ensureGtagLoaded().then(() => {
    try {
      window.gtag?.('event', 'conversion', {
        send_to: SIGNUP_SEND_TO,
      })
      // Also emit a GA4-style custom event for dashboards keyed on it.
      window.gtag?.('event', 'signup_success')
    } catch {
      /* swallow — tracking must never break registration UX */
    }
  })
}

/**
 * Fire the "top-up" (purchase) conversion. No-op unless the gtag account id and
 * the top-up send_to are configured. Pass the top-up value in USD so Google Ads
 * can optimize on revenue. Best-effort: failures never throw.
 */
export function trackTopupConversion(valueUSD?: number): void {
  if (!CONVERSION_ID || !TOPUP_SEND_TO) return
  void ensureGtagLoaded().then(() => {
    try {
      window.gtag?.('event', 'conversion', {
        send_to: TOPUP_SEND_TO,
        ...(typeof valueUSD === 'number' && valueUSD > 0
          ? { value: valueUSD, currency: 'USD' }
          : {}),
      })
      // GA4-style custom event for dashboards keyed on it.
      window.gtag?.('event', 'topup_success', {
        ...(typeof valueUSD === 'number' && valueUSD > 0
          ? { value: valueUSD, currency: 'USD' }
          : {}),
      })
    } catch {
      /* swallow — tracking must never break the payment UX */
    }
  })
}

export function trackAdsFunnelEvent(
  eventName: string,
  params: GtagEventParams = {}
): void {
  if (!CONVERSION_ID) return
  void ensureGtagLoaded().then(() => {
    try {
      window.gtag?.('event', eventName, {
        send_to: CONVERSION_ID,
        event_category: 'ads_funnel',
        ...params,
      })
    } catch {
      /* tracking must never break product UX */
    }
  })
}

export interface GAMeasurementIdentifiers {
  ga_client_id?: string
  ga_session_id?: string
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined') return ''
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escapedName}=([^;]*)`)
  )
  if (!match) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function parseGAClientID(cookieValue: string): string | undefined {
  const parts = cookieValue.split('.')
  if (parts.length < 4) return undefined
  const clientID = parts.slice(-2).join('.')
  return /^\d+\.\d+$/.test(clientID) ? clientID : undefined
}

function parseGASessionID(cookieValue: string): string | undefined {
  const gs2Match = cookieValue.match(/(?:^|[.$])s(\d+)(?:[.$]|$)/)
  if (gs2Match?.[1]) return gs2Match[1]

  const parts = cookieValue.split('.')
  if (parts.length >= 3 && /^GS\d+$/.test(parts[0]) && /^\d+$/.test(parts[2])) {
    return parts[2]
  }
  return undefined
}

export function getGAMeasurementIdentifiers(): GAMeasurementIdentifiers {
  const gaClientID = parseGAClientID(getCookieValue('_ga'))
  const cookieSuffix = GA_MEASUREMENT_ID.replace(/^G-/, '').replace(/-/g, '_')
  const gaSessionID = parseGASessionID(getCookieValue(`_ga_${cookieSuffix}`))
  return {
    ...(gaClientID ? { ga_client_id: gaClientID } : {}),
    ...(gaSessionID ? { ga_session_id: gaSessionID } : {}),
  }
}
