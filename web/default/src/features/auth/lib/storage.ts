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
 * Utilities for managing authentication-related browser storage
 */
import {
  clearRecallClaimPostLoginStorage,
  containsRecallClaimInURL,
  isSafeInternalPath,
  readRecallClaimPostLoginRecord,
  RECALL_CLAIM_OAUTH_NONCE_STORAGE_KEY,
  RECALL_CLAIM_POST_LOGIN_STORAGE_KEY,
  type RecallClaimPostLoginRecord,
} from '@/lib/analytics/recall-claim'

export { isSafeInternalPath } from '@/lib/analytics/recall-claim'

// ============================================================================
// LocalStorage Keys
// ============================================================================

const STORAGE_KEYS = {
  USER_ID: 'uid',
  AFFILIATE: 'aff',
  STATUS: 'status',
  PENDING_ONBOARDING: 'pending_onboarding',
  LEGACY_PENDING_PLAYGROUND_FIRST_RUN: 'pending_playground_first_run',
  // Post-login destination to honor after an OAuth round-trip. Lives in sessionStorage
  // (tab-scoped) because OAuth providers redirect to a fixed redirect_uri (/oauth/<p>)
  // that can't carry our ?redirect=... param, so the URL alone would lose the intent.
  POST_LOGIN_REDIRECT: RECALL_CLAIM_POST_LOGIN_STORAGE_KEY,
  OAUTH_REDIRECT_NONCE: RECALL_CLAIM_OAUTH_NONCE_STORAGE_KEY,
} as const

type PendingPostLoginRedirectRecord = RecallClaimPostLoginRecord

export type ProtectedRecallRedirect = {
  nonce: string
  sanitizedTarget: string
}

export type PendingPostLoginRedirectSnapshot = {
  nonce: string
  target: string
}

// Only allow same-origin, absolute internal paths — never an external URL. Rejects
// protocol-relative ("//host"), backslash forms (browsers normalize "\" -> "/", so
// "/\evil.com" becomes "//evil.com" -> external), and any control/whitespace chars that
// can be stripped to forge an external target. Used to gate post-login redirects against
// open-redirect.
export type AuthContinuationSearch = {
  redirect: string
  recall_redirect?: string
}

export function buildAuthContinuationSearch(
  visibleRedirect?: string | null,
  recallRedirectNonce?: string | null
): AuthContinuationSearch | undefined {
  if (!isSafeInternalPath(visibleRedirect)) return undefined
  if (!recallRedirectNonce) return { redirect: visibleRedirect }
  if (recallRedirectNonce.length > 128) return undefined
  return {
    redirect: visibleRedirect,
    recall_redirect: recallRedirectNonce,
  }
}

export type ScrubbedRecallClaimAuthURL = {
  postLoginRedirect: string | null
  sanitizedURL: string
}

export function sanitizeRecallClaimRedirect(path: string, depth = 0): string {
  if (depth > 2) return '/'

  const url = new URL(path, 'https://console.invalid')
  url.searchParams.delete('recall_claim')
  if (url.pathname.endsWith('/recall/claim')) {
    url.searchParams.delete('claim')
  }

  for (const nestedRedirect of url.searchParams.getAll('redirect')) {
    if (!containsRecallClaimInURL(nestedRedirect)) continue
    url.searchParams.set(
      'redirect',
      sanitizeRecallClaimRedirect(nestedRedirect, depth + 1)
    )
    break
  }

  return `${url.pathname}${url.search}${url.hash}`
}

export function scrubRecallClaimFromAuthURL(
  rawURL: string,
  recallRedirectNonce?: string
): ScrubbedRecallClaimAuthURL | null {
  if (!containsRecallClaimInURL(rawURL)) return null

  try {
    const url = new URL(rawURL, 'https://console.invalid')
    const directClaim = url.searchParams.get('recall_claim')
    const nestedRedirect = url.searchParams
      .getAll('redirect')
      .find((redirect) => containsRecallClaimInURL(redirect))

    let postLoginRedirect: string | null = null
    let sanitizedRedirect: string | null = null
    if (isSafeInternalPath(nestedRedirect)) {
      postLoginRedirect = nestedRedirect
      sanitizedRedirect = sanitizeRecallClaimRedirect(nestedRedirect)
    } else if (directClaim !== null) {
      const walletURL = new URL('/console/topup', 'https://console.invalid')
      walletURL.searchParams.set('recall_claim', directClaim)
      postLoginRedirect = `${walletURL.pathname}${walletURL.search}`
      sanitizedRedirect = walletURL.pathname
    }

    const sanitizedSearch = new URLSearchParams()
    if (sanitizedRedirect && recallRedirectNonce) {
      sanitizedSearch.set('redirect', sanitizedRedirect)
      sanitizedSearch.set('recall_redirect', recallRedirectNonce)
    }
    for (const [key, value] of url.searchParams) {
      if (key === 'recall_claim' || key === 'redirect') continue
      sanitizedSearch.append(key, value)
    }
    url.search = sanitizedSearch.toString()

    return {
      postLoginRedirect,
      sanitizedURL: url.toString(),
    }
  } catch {
    return null
  }
}

export function protectRecallClaimOnAuthRoute(rawURL: string): string | null {
  if (typeof window === 'undefined') return null

  const nonce = createPostLoginRedirectNonce()
  if (!nonce) return null

  const result = scrubRecallClaimFromAuthURL(rawURL, nonce)
  if (!result) return null

  if (result.postLoginRedirect) {
    const sanitizedTarget = sanitizeRecallClaimRedirect(
      result.postLoginRedirect
    )
    savePendingPostLoginRedirectRecord({
      nonce,
      rawTarget: result.postLoginRedirect,
      sanitizedTarget,
      createdAt: Date.now(),
    })
  } else {
    clearPendingPostLoginRedirect()
  }
  const sanitizedURL = new URL(result.sanitizedURL)
  const sanitizedHref = `${sanitizedURL.pathname}${sanitizedURL.search}${sanitizedURL.hash}`
  window.history.replaceState(window.history.state, '', sanitizedHref)
  return sanitizedHref
}

export function protectRecallClaimRedirectForAuth(
  redirectPath: string
): ProtectedRecallRedirect | null {
  if (
    !isSafeInternalPath(redirectPath) ||
    !containsRecallClaimInURL(redirectPath)
  ) {
    return null
  }

  const sanitizedTarget = sanitizeRecallClaimRedirect(redirectPath)
  const nonce = createPostLoginRedirectNonce()
  if (!nonce) return null

  savePendingPostLoginRedirectRecord({
    nonce,
    rawTarget: redirectPath,
    sanitizedTarget,
    createdAt: Date.now(),
  })
  return { nonce, sanitizedTarget }
}

export function resolvePendingPostLoginRedirect(
  visibleRedirect: string | null | undefined,
  recallRedirectNonce?: string | null
): string | undefined {
  if (!isSafeInternalPath(visibleRedirect)) {
    if (recallRedirectNonce) clearPendingPostLoginRedirect()
    return undefined
  }
  if (!recallRedirectNonce) {
    clearPendingPostLoginRedirect()
    return visibleRedirect
  }

  const record = readPendingPostLoginRedirectRecord(recallRedirectNonce)
  if (!record) return visibleRedirect

  if (visibleRedirect !== record.sanitizedTarget) {
    clearPendingPostLoginRedirect()
    return visibleRedirect
  }
  return record.rawTarget
}

// ============================================================================
// Post-login Redirect Storage (OAuth round-trip)
// ============================================================================

/**
 * Persist (or clear) the post-login destination for an in-flight OAuth login. Pass the
 * current `?redirect=` value; a missing/invalid value clears any stale entry so a previous
 * intent can't leak into an unrelated OAuth login in the same tab.
 */
function savePendingPostLoginRedirect(
  path: string | null | undefined
): string | null {
  if (!isSafeInternalPath(path)) {
    clearPendingPostLoginRedirect()
    return null
  }

  const nonce = createPostLoginRedirectNonce()
  if (!nonce) return null
  savePendingPostLoginRedirectRecord({
    nonce,
    rawTarget: path,
    sanitizedTarget: path,
    createdAt: Date.now(),
  })
  return nonce
}

export function preparePendingPostLoginRedirectForOAuth(
  visibleRedirect: string | null | undefined,
  recallRedirectNonce?: string | null
): PendingPostLoginRedirectSnapshot | null {
  let record: PendingPostLoginRedirectRecord | null
  if (recallRedirectNonce) {
    const target = resolvePendingPostLoginRedirect(
      visibleRedirect,
      recallRedirectNonce
    )
    record = readPendingPostLoginRedirectRecord(recallRedirectNonce)
    if (!record || target !== record.rawTarget) return null
  } else {
    const nonce = savePendingPostLoginRedirect(visibleRedirect)
    if (!nonce) return null
    record = readPendingPostLoginRedirectRecord(nonce)
  }

  if (!record || typeof window === 'undefined') return null
  try {
    window.sessionStorage.setItem(
      STORAGE_KEYS.OAUTH_REDIRECT_NONCE,
      record.nonce
    )
    return { nonce: record.nonce, target: record.rawTarget }
  } catch (error) {
    clearPendingPostLoginRedirect()
    // eslint-disable-next-line no-console
    console.error('Failed to bind OAuth post-login redirect:', error)
    return null
  }
}

export function peekPendingOAuthPostLoginRedirect(): PendingPostLoginRedirectSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const nonce = window.sessionStorage.getItem(
      STORAGE_KEYS.OAUTH_REDIRECT_NONCE
    )
    if (!nonce) {
      clearPendingPostLoginRedirect()
      return null
    }
    const record = readPendingPostLoginRedirectRecord(nonce)
    return record ? { nonce: record.nonce, target: record.rawTarget } : null
  } catch (error) {
    clearPendingPostLoginRedirect()
    // eslint-disable-next-line no-console
    console.error('Failed to read OAuth post-login redirect:', error)
    return null
  }
}

export function consumePendingPostLoginRedirect(
  expectedNonce?: string | null
): boolean {
  if (typeof window === 'undefined') return false
  const record = readPendingPostLoginRedirectRecord(expectedNonce || undefined)
  const matched = Boolean(record)
  clearPendingPostLoginRedirect()
  return matched
}

export function clearPendingPostLoginRedirect(): void {
  if (typeof window === 'undefined') return
  try {
    clearRecallClaimPostLoginStorage(window.sessionStorage)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear post-login redirect:', error)
  }
}

function createPostLoginRedirectNonce(): string | null {
  try {
    if (typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to create post-login redirect nonce:', error)
    return null
  }
}

function savePendingPostLoginRedirectRecord(
  record: PendingPostLoginRedirectRecord
): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      STORAGE_KEYS.POST_LOGIN_REDIRECT,
      JSON.stringify(record)
    )
    window.sessionStorage.removeItem(STORAGE_KEYS.OAUTH_REDIRECT_NONCE)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist post-login redirect:', error)
  }
}

function readPendingPostLoginRedirectRecord(
  expectedNonce?: string
): PendingPostLoginRedirectRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const record = readRecallClaimPostLoginRecord(window.sessionStorage)
    if (!record) return null
    if (expectedNonce && record.nonce !== expectedNonce) {
      clearPendingPostLoginRedirect()
      return null
    }

    return record
  } catch (error) {
    clearPendingPostLoginRedirect()
    // eslint-disable-next-line no-console
    console.error('Failed to read post-login redirect:', error)
    return null
  }
}

// ============================================================================
// Onboarding Storage
// ============================================================================

/**
 * Mark that the user just registered and should be guided through onboarding
 * on their next successful login.
 */
export function setPendingOnboarding(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.PENDING_ONBOARDING, '1')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to set pending onboarding flag:', error)
  }
}

/**
 * Consume the pending-onboarding flag, returning whether it was set.
 */
export function consumePendingOnboarding(): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.removeItem(
      STORAGE_KEYS.LEGACY_PENDING_PLAYGROUND_FIRST_RUN
    )
    const value = window.localStorage.getItem(STORAGE_KEYS.PENDING_ONBOARDING)
    if (value) {
      window.localStorage.removeItem(STORAGE_KEYS.PENDING_ONBOARDING)
      return true
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to consume pending onboarding flag:', error)
  }
  return false
}

// ============================================================================
// User ID Storage
// ============================================================================

/**
 * Save user ID to localStorage
 */
export function saveUserId(userId: number | string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.USER_ID, String(userId))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save user ID:', error)
  }
}

/**
 * Get user ID from localStorage
 */
export function getUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEYS.USER_ID)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get user ID:', error)
    return null
  }
}

/**
 * Remove user ID from localStorage
 */
export function removeUserId(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEYS.USER_ID)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to remove user ID:', error)
  }
}

// ============================================================================
// Affiliate Code Storage
// ============================================================================

/**
 * Get affiliate code from localStorage
 */
export function getAffiliateCode(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(STORAGE_KEYS.AFFILIATE) ?? ''
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get affiliate code:', error)
    return ''
  }
}

/**
 * Save affiliate code to localStorage
 */
export function saveAffiliateCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEYS.AFFILIATE, code)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save affiliate code:', error)
  }
}
