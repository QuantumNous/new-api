/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import * as amplitude from '@amplitude/unified'
import type { AuthUser } from '@/stores/auth-store'
import {
  containsRecallClaimInURL,
  isRecallClaimAnalyticsBlocked,
} from './recall-claim'

export { containsRecallClaimInURL } from './recall-claim'

type AnalyticsProperties = Record<string, string | number | boolean | undefined>
export type AnalyticsConsentStatus = 'granted' | 'denied' | 'unknown'

export const ANALYTICS_CONSENT_KEY = 'flatkey_analytics_consent'
export const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as
  | string
  | undefined

let initialized = false

export function initializeAmplitude() {
  if (initialized) return

  const apiKey = AMPLITUDE_API_KEY
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn('Amplitude API key missing — analytics disabled.')
    return
  }
  if (!shouldEnableAmplitude()) return

  initialized = true
  void amplitude.initAll(apiKey, {
    analytics: { autocapture: true },
    sessionReplay: { sampleRate: 1 },
  })
}

function getCookieConsent(): AnalyticsConsentStatus {
  if (typeof document === 'undefined') return 'unknown'
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${ANALYTICS_CONSENT_KEY}=([^;]*)`)
  )
  if (!match) return 'unknown'
  return match[1] === 'granted'
    ? 'granted'
    : match[1] === 'denied'
      ? 'denied'
      : 'unknown'
}

export function getAnalyticsConsentStatus(): AnalyticsConsentStatus {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage?.getItem(ANALYTICS_CONSENT_KEY)
    if (saved === 'granted' || saved === 'denied') return saved
  }
  return getCookieConsent()
}

export function isStagingAnalyticsHost(): boolean {
  if (typeof window === 'undefined') return false
  const hostname = window.location?.hostname || ''
  return (
    hostname === 'staging-console.flatkey.ai' || hostname.startsWith('staging-')
  )
}

export function shouldEnableAmplitude(): boolean {
  return (
    Boolean(AMPLITUDE_API_KEY) &&
    !isStagingAnalyticsHost() &&
    !isRecallClaimAnalyticsBlocked() &&
    getAnalyticsConsentStatus() === 'granted'
  )
}

function persistConsent(
  status: Exclude<AnalyticsConsentStatus, 'unknown'>
): void {
  if (typeof window === 'undefined') return
  window.localStorage?.setItem(ANALYTICS_CONSENT_KEY, status)
  const attrs = ['path=/', 'max-age=31536000', 'SameSite=Lax']
  const hostname = window.location?.hostname
  if (hostname === 'flatkey.ai' || hostname?.endsWith('.flatkey.ai')) {
    attrs.push('domain=.flatkey.ai')
  }
  if (window.location?.protocol === 'https:') attrs.push('Secure')
  document.cookie = `${ANALYTICS_CONSENT_KEY}=${status}; ${attrs.join('; ')}`
}

export function grantAnalyticsConsent(): void {
  persistConsent('granted')
  initializeAmplitude()
}

export function denyAnalyticsConsent(): void {
  persistConsent('denied')
  amplitude.setOptOut(true)
}

export function ensureAmplitudeInitialized(): Promise<boolean> {
  initializeAmplitude()
  return Promise.resolve(initialized)
}

export function suspendAmplitudeForRecallClaim(rawURL: string): void {
  if (!containsRecallClaimInURL(rawURL) || typeof window === 'undefined') return
  amplitude.setOptOut(true)
  amplitude.sessionReplay()?.shutdown()
}

export function resumeAmplitudeAfterRecallClaim(): void {
  if (
    typeof window === 'undefined' ||
    containsRecallClaimInURL(window.location?.href || '')
  ) {
    return
  }
  amplitude.setOptOut(false)
  initializeAmplitude()
}

export function trackAmplitudeEvent(
  eventName: string,
  properties: AnalyticsProperties = {}
): void {
  if (!shouldEnableAmplitude()) return
  initializeAmplitude()
  amplitude.track(eventName, properties)
}

export function trackAmplitudePageView(pathname: string, search = ''): void {
  const sanitizedSearch = sanitizeAmplitudePageSearch(search)
  trackAmplitudeEvent('page_viewed', {
    path: pathname,
    ...(sanitizedSearch ? { search: sanitizedSearch } : {}),
    product_surface: 'console',
  })
}

export function sanitizeAmplitudePageSearch(search: string): string {
  if (!search) return ''
  const searchParams = new URLSearchParams(search)
  searchParams.delete('recall_claim')
  const sanitizedSearch = searchParams.toString()
  return sanitizedSearch ? `?${sanitizedSearch}` : ''
}

export function identifyAmplitudeUser(user: AuthUser | null | undefined): void {
  if (!user?.id || !shouldEnableAmplitude()) return
  initializeAmplitude()
  amplitude.setUserId(String(user.id))
  const identify = new amplitude.Identify()
  identify.set('user_id', user.id)
  identify.set('role', user.role)
  if (user.status !== undefined) identify.set('status', user.status)
  if (user.group !== undefined) identify.set('group', user.group)
  identify.set('has_email', Boolean(user.email))
  amplitude.identify(identify)
}

export function resetAmplitudeIdentity(): void {
  if (!shouldEnableAmplitude()) return
  amplitude.reset()
}
