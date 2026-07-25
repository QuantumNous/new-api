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
 * Multi-network ad pixel helper: TikTok, Meta (Facebook/Instagram), X (Twitter).
 *
 * Mirrors the design of `gtag.ts`: zero-dependency, opt-in per network via env
 * var. Any pixel whose id is not set at build time is a complete no-op, so
 * deployments without those ad accounts are unaffected.
 *
 * Env vars (all optional, prefix VITE_ so Rsbuild exposes them to the client):
 *   VITE_TIKTOK_PIXEL_ID      TikTok Events Manager pixel id, e.g. "CXXXXXXXXX"
 *   VITE_META_PIXEL_ID        Meta Events Manager pixel id, e.g. "1234567890"
 *   VITE_X_PIXEL_ID           X Ads pixel id, e.g. "abcde"
 *   VITE_X_SIGNUP_EVENT_ID    X conversion event id for signup,
 *                             e.g. "tw-abcde-fghij" (created in X Events Manager)
 *
 * Loading is lazy: nothing is injected until a page-view or conversion call,
 * and script failures never surface to the UI (ad blockers are common).
 */
import { isRecallClaimAnalyticsBlocked } from './recall-claim'

type QueueFn = (...args: unknown[]) => void

declare global {
  interface Window {
    // TikTok
    TiktokAnalyticsObject?: string
    ttq?: {
      load: (id: string) => void
      page: () => void
      track: (event: string, params?: Record<string, unknown>) => void
      [key: string]: unknown
    }
    // Meta
    fbq?: QueueFn & { queue?: unknown[]; loaded?: boolean; version?: string }
    _fbq?: unknown
    // X
    twq?: QueueFn & { queue?: unknown[]; exe?: QueueFn; version?: string }
  }
}

const TIKTOK_PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID as
  | string
  | undefined
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined
const X_PIXEL_ID = import.meta.env.VITE_X_PIXEL_ID as string | undefined
// Full event id (e.g. "tw-abcde-fghij"); X conversions are keyed by event id,
// not by event name, so it is kept as a complete value like gtag's send_to.
const X_SIGNUP_EVENT_ID = import.meta.env.VITE_X_SIGNUP_EVENT_ID as
  | string
  | undefined
// X conversion event id for a completed top-up (purchase).
const X_TOPUP_EVENT_ID = import.meta.env.VITE_X_TOPUP_EVENT_ID as
  | string
  | undefined

let tiktokLoaded = false
let metaLoaded = false
let xLoaded = false

export function shouldInitializePixelsForURL(rawURL: string): boolean {
  return !isRecallClaimAnalyticsBlocked(rawURL)
}

function injectScript(src: string): void {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  // Never block UX on a blocked tracker — errors are intentionally swallowed.
  s.onerror = () => undefined
  document.head.appendChild(s)
}

/** Lazily bootstrap the TikTok pixel (ttq) exactly once. */
function ensureTiktok(): void {
  if (
    !TIKTOK_PIXEL_ID ||
    typeof window === 'undefined' ||
    tiktokLoaded ||
    !shouldInitializePixelsForURL(window.location?.href || '')
  )
    return
  tiktokLoaded = true
  try {
    window.TiktokAnalyticsObject = 'ttq'
    // Minimal queue shim: buffer calls until events.js replaces it.
    const methods = [
      'page',
      'track',
      'identify',
      'instances',
      'debug',
      'on',
      'off',
      'once',
      'ready',
      'alias',
      'group',
      'enableCookie',
      'disableCookie',
    ]
    const queue: unknown[][] = []
    const ttq: Record<string, unknown> = { _q: queue }
    for (const m of methods) {
      ttq[m] = (...args: unknown[]) => {
        queue.push([m, ...args])
      }
    }
    ttq.load = () => undefined // replaced by events.js
    ttq.page = () => {
      queue.push(['page'])
    }
    window.ttq = (window.ttq ?? ttq) as NonNullable<Window['ttq']>
    injectScript(
      `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${TIKTOK_PIXEL_ID}&lib=ttq`
    )
    window.ttq.page()
  } catch {
    /* tracking must never break product UX */
  }
}

/** Lazily bootstrap the Meta pixel (fbq) exactly once. */
function ensureMeta(): void {
  if (
    !META_PIXEL_ID ||
    typeof window === 'undefined' ||
    metaLoaded ||
    !shouldInitializePixelsForURL(window.location?.href || '')
  )
    return
  metaLoaded = true
  try {
    if (!window.fbq) {
      const fbq: NonNullable<Window['fbq']> = function fbq() {
        // fbevents.js consumes `arguments` pushed verbatim.
        // eslint-disable-next-line prefer-rest-params
        fbq.queue!.push(arguments)
      }
      fbq.queue = []
      fbq.loaded = true
      fbq.version = '2.0'
      window.fbq = fbq
      window._fbq = fbq
      injectScript('https://connect.facebook.net/en_US/fbevents.js')
    }
    window.fbq('init', META_PIXEL_ID)
    window.fbq('track', 'PageView')
  } catch {
    /* tracking must never break product UX */
  }
}

/** Lazily bootstrap the X pixel (twq) exactly once. */
function ensureX(): void {
  if (
    !X_PIXEL_ID ||
    typeof window === 'undefined' ||
    xLoaded ||
    !shouldInitializePixelsForURL(window.location?.href || '')
  )
    return
  xLoaded = true
  try {
    if (!window.twq) {
      const twq = function () {
        const self = twq as NonNullable<Window['twq']>
        if (self.exe) {
          // eslint-disable-next-line prefer-rest-params
          self.exe.apply(self, arguments as unknown as [])
        } else {
          // eslint-disable-next-line prefer-rest-params
          self.queue!.push(arguments)
        }
      } as NonNullable<Window['twq']>
      twq.version = '1.1'
      twq.queue = []
      window.twq = twq
      injectScript('https://static.ads-twitter.com/uwt.js')
    }
    window.twq('config', X_PIXEL_ID)
  } catch {
    /* tracking must never break product UX */
  }
}

/** Whether at least one ad pixel is configured. */
export function isAnyPixelEnabled(): boolean {
  return Boolean(TIKTOK_PIXEL_ID || META_PIXEL_ID || X_PIXEL_ID)
}

/**
 * Load every configured pixel and record a page view. Call on ad landing
 * surfaces (home, sign-up) so the networks can build retargeting audiences.
 * No-op for networks without an id.
 */
export function ensurePixelsLoaded(): void {
  if (isRecallClaimAnalyticsBlocked()) return
  ensureTiktok()
  ensureMeta()
  ensureX()
}

/**
 * Fire the "sign up" conversion on every configured network. Mirrors
 * gtag's trackSignupConversion and is called from the same two success
 * paths (password sign-up + OAuth first-login). Best-effort: never throws.
 */
export function trackPixelsSignup(): void {
  if (isRecallClaimAnalyticsBlocked()) return
  ensurePixelsLoaded()
  try {
    if (TIKTOK_PIXEL_ID) window.ttq?.track('CompleteRegistration')
    if (META_PIXEL_ID) window.fbq?.('track', 'CompleteRegistration')
    if (X_PIXEL_ID && X_SIGNUP_EVENT_ID)
      window.twq?.('event', X_SIGNUP_EVENT_ID, {})
  } catch {
    /* tracking must never break registration UX */
  }
}

/**
 * Fire the "top-up" (purchase) conversion on every configured network. Mirrors
 * gtag's trackTopupConversion. Pass the value in USD so networks can optimize
 * on revenue. Best-effort: never throws.
 */
export function trackPixelsTopup(valueUSD?: number): void {
  if (isRecallClaimAnalyticsBlocked()) return
  ensurePixelsLoaded()
  const hasValue = typeof valueUSD === 'number' && valueUSD > 0
  try {
    if (TIKTOK_PIXEL_ID)
      window.ttq?.track(
        'CompletePayment',
        hasValue ? { value: valueUSD, currency: 'USD' } : undefined
      )
    if (META_PIXEL_ID)
      window.fbq?.(
        'track',
        'Purchase',
        hasValue ? { value: valueUSD, currency: 'USD' } : {}
      )
    if (X_PIXEL_ID && X_TOPUP_EVENT_ID)
      window.twq?.(
        'event',
        X_TOPUP_EVENT_ID,
        hasValue ? { value: valueUSD, currency: 'USD' } : {}
      )
  } catch {
    /* tracking must never break the payment UX */
  }
}
