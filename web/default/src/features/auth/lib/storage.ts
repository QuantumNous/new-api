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
  POST_LOGIN_REDIRECT: 'auth_post_login_redirect',
} as const

// Only allow same-origin, absolute internal paths — never an external URL. Rejects
// protocol-relative ("//host"), backslash forms (browsers normalize "\" -> "/", so
// "/\evil.com" becomes "//evil.com" -> external), and any control/whitespace chars that
// can be stripped to forge an external target. Used to gate post-login redirects against
// open-redirect.
export function isSafeInternalPath(
  path: string | null | undefined
): path is string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false
  if (path.includes('\\')) return false
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f\s]/.test(path)
}

// ============================================================================
// Post-login Redirect Storage (OAuth round-trip)
// ============================================================================

/**
 * Persist (or clear) the post-login destination for an in-flight OAuth login. Pass the
 * current `?redirect=` value; a missing/invalid value clears any stale entry so a previous
 * intent can't leak into an unrelated OAuth login in the same tab.
 */
export function savePendingPostLoginRedirect(
  path: string | null | undefined
): void {
  if (typeof window === 'undefined') return
  try {
    if (isSafeInternalPath(path)) {
      window.sessionStorage.setItem(STORAGE_KEYS.POST_LOGIN_REDIRECT, path)
    } else {
      window.sessionStorage.removeItem(STORAGE_KEYS.POST_LOGIN_REDIRECT)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to persist post-login redirect:', error)
  }
}

/**
 * Read the persisted post-login destination (a safe internal path, or null). Does NOT clear
 * it: the entry's lifecycle is owned by savePendingPostLoginRedirect, which sets-or-clears it
 * at the start of every OAuth attempt. Reading without deleting keeps the value stable across
 * React StrictMode's double-invoked effects, so the callback redirects consistently instead of
 * the second invocation seeing an already-cleared entry and falling back to the dashboard.
 */
export function readPendingPostLoginRedirect(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem(
      STORAGE_KEYS.POST_LOGIN_REDIRECT
    )
    return isSafeInternalPath(value) ? value : null
  } catch (error) {
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
