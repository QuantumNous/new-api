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
import type { AuthUser } from '@/stores/auth-store'

type MixpanelProperties = Record<
  string,
  string | number | boolean | undefined
>

type MixpanelClient = {
  init: (
    token: string,
    config?: Record<string, string | number | boolean | undefined>
  ) => void
  identify: (distinctID: string) => void
  people?: {
    set: (properties: MixpanelProperties) => void
  }
  reset: () => void
  track: (eventName: string, properties?: MixpanelProperties) => void
}

declare global {
  interface Window {
    mixpanel?: MixpanelClient
  }
}

export type MixpanelConsentStatus = 'granted' | 'denied' | 'unknown'

export const MIXPANEL_CONSENT_KEY = 'flatkey_analytics_consent'
export const MIXPANEL_TOKEN =
  (import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined) ||
  'cf2f149bd61f607c3fd578596ad86921'

const MIXPANEL_SCRIPT_SRC =
  'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'

let loaderPromise: Promise<boolean> | null = null
let initialized = false

function getCookieConsent(): MixpanelConsentStatus {
  if (typeof document === 'undefined') return 'unknown'
  const escapedName = MIXPANEL_CONSENT_KEY.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  )
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escapedName}=([^;]*)`)
  )
  if (!match) return 'unknown'
  return match[1] === 'granted'
    ? 'granted'
    : match[1] === 'denied'
      ? 'denied'
      : 'unknown'
}

export function getMixpanelConsentStatus(): MixpanelConsentStatus {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage?.getItem(MIXPANEL_CONSENT_KEY)
    if (saved === 'granted' || saved === 'denied') return saved
  }
  return getCookieConsent()
}

export function shouldEnableMixpanel(): boolean {
  return Boolean(MIXPANEL_TOKEN) && getMixpanelConsentStatus() === 'granted'
}

function persistConsent(status: Exclude<MixpanelConsentStatus, 'unknown'>): void {
  if (typeof window === 'undefined') return
  window.localStorage?.setItem(MIXPANEL_CONSENT_KEY, status)

  const attrs = ['path=/', 'max-age=31536000', 'SameSite=Lax']
  const hostname = window.location?.hostname
  if (hostname === 'flatkey.ai' || hostname?.endsWith('.flatkey.ai')) {
    attrs.push('domain=.flatkey.ai')
  }
  if (window.location?.protocol === 'https:') attrs.push('Secure')
  document.cookie = `${MIXPANEL_CONSENT_KEY}=${status}; ${attrs.join('; ')}`
}

export function grantMixpanelConsent(): void {
  persistConsent('granted')
  void ensureMixpanelLoaded()
}

export function denyMixpanelConsent(): void {
  persistConsent('denied')
}

function initializeMixpanel(): boolean {
  if (initialized || !window.mixpanel || !shouldEnableMixpanel()) {
    return initialized
  }
  window.mixpanel.init(MIXPANEL_TOKEN, {
    persistence: 'localStorage',
    ignore_dnt: false,
    autocapture: true,
    record_sessions_percent: 100,
  })
  initialized = true
  return true
}

export function ensureMixpanelLoaded(): Promise<boolean> {
  if (typeof window === 'undefined' || !shouldEnableMixpanel()) {
    return Promise.resolve(false)
  }
  if (window.mixpanel) return Promise.resolve(initializeMixpanel())
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script')
    script.async = true
    script.src = MIXPANEL_SCRIPT_SRC
    script.onload = () => resolve(initializeMixpanel())
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return loaderPromise
}

export function trackMixpanelEvent(
  eventName: string,
  properties: MixpanelProperties = {}
): void {
  if (!shouldEnableMixpanel()) return
  void ensureMixpanelLoaded().then((ready) => {
    if (!ready) return
    try {
      window.mixpanel?.track(eventName, properties)
    } catch {
      /* analytics must never break product UX */
    }
  })
}

export function trackMixpanelPageView(
  pathname: string,
  search = ''
): void {
  trackMixpanelEvent('page_viewed', {
    path: pathname,
    ...(search ? { search } : {}),
    product_surface: 'console',
  })
}

export function identifyMixpanelUser(user: AuthUser | null | undefined): void {
  if (!user?.id || !shouldEnableMixpanel()) return
  void ensureMixpanelLoaded().then((ready) => {
    if (!ready) return
    try {
      window.mixpanel?.identify(String(user.id))
      window.mixpanel?.people?.set({
        user_id: user.id,
        $email: user.email,
        email: user.email,
        role: user.role,
        status: user.status,
        group: user.group,
        has_email: Boolean(user.email),
      })
    } catch {
      /* analytics must never break auth UX */
    }
  })
}

export function resetMixpanelIdentity(): void {
  if (!shouldEnableMixpanel()) return
  void ensureMixpanelLoaded().then((ready) => {
    if (!ready) return
    try {
      window.mixpanel?.reset()
    } catch {
      /* analytics must never break auth UX */
    }
  })
}
