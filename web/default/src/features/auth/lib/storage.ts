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
  PENDING_PLAYGROUND_FIRST_RUN: 'pending_playground_first_run',
  // Post-login destination to honor after an OAuth round-trip. Lives in sessionStorage
  // (tab-scoped) because OAuth providers redirect to a fixed redirect_uri (/oauth/<p>)
  // that can't carry our ?redirect=... param, so the URL alone would lose the intent.
  POST_LOGIN_REDIRECT: 'auth_post_login_redirect',
} as const

const PENDING_PLAYGROUND_FIRST_RUN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type PendingPlaygroundFirstRunIdentity = {
  email?: string
  username?: string
}

type PendingPlaygroundFirstRunPayload = PendingPlaygroundFirstRunIdentity & {
  createdAt: number
}

function normalizePendingPlaygroundFirstRunIdentifier(
  value: string | null | undefined
): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized || undefined
}

function parsePendingPlaygroundFirstRunPayload(
  value: string | null
): PendingPlaygroundFirstRunPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<PendingPlaygroundFirstRunPayload>
    const email = normalizePendingPlaygroundFirstRunIdentifier(parsed.email)
    const username = normalizePendingPlaygroundFirstRunIdentifier(
      parsed.username
    )
    const createdAt =
      typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt)
        ? parsed.createdAt
        : 0
    if (!createdAt || (!email && !username)) return null
    return { email, username, createdAt }
  } catch {
    return null
  }
}

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

/**
 * Mark that the user just registered and should land in Playground first-run
 * on their next successful login.
 */
export function setPendingPlaygroundFirstRun(
  identity: PendingPlaygroundFirstRunIdentity
): void {
  if (typeof window === 'undefined') return
  const email = normalizePendingPlaygroundFirstRunIdentifier(identity.email)
  const username = normalizePendingPlaygroundFirstRunIdentifier(
    identity.username
  )
  if (!email && !username) return
  try {
    const payload: PendingPlaygroundFirstRunPayload = {
      email,
      username,
      createdAt: Date.now(),
    }
    window.localStorage.setItem(
      STORAGE_KEYS.PENDING_PLAYGROUND_FIRST_RUN,
      JSON.stringify(payload)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to set pending Playground first-run flag:', error)
  }
}

/**
 * Consume the pending Playground first-run flag only when the logged-in user
 * matches the account that just registered. A mismatch leaves the unexpired
 * flag in place so the intended new account can still receive first-run later.
 */
export function consumePendingPlaygroundFirstRun(
  identity: PendingPlaygroundFirstRunIdentity
): boolean {
  if (typeof window === 'undefined') return false
  const currentEmail = normalizePendingPlaygroundFirstRunIdentifier(
    identity.email
  )
  const currentUsername = normalizePendingPlaygroundFirstRunIdentifier(
    identity.username
  )
  try {
    const payload = parsePendingPlaygroundFirstRunPayload(
      window.localStorage.getItem(STORAGE_KEYS.PENDING_PLAYGROUND_FIRST_RUN)
    )
    if (!payload) {
      window.localStorage.removeItem(STORAGE_KEYS.PENDING_PLAYGROUND_FIRST_RUN)
      return false
    }
    const now = Date.now()
    const isExpired =
      payload.createdAt > now ||
      now - payload.createdAt > PENDING_PLAYGROUND_FIRST_RUN_TTL_MS
    if (isExpired) {
      window.localStorage.removeItem(STORAGE_KEYS.PENDING_PLAYGROUND_FIRST_RUN)
      return false
    }
    const matchesUsername =
      payload.username !== undefined && payload.username === currentUsername
    const matchesEmail =
      payload.email === undefined ||
      currentEmail === undefined ||
      payload.email === currentEmail
    if (matchesUsername && matchesEmail) {
      window.localStorage.removeItem(STORAGE_KEYS.PENDING_PLAYGROUND_FIRST_RUN)
      return true
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to consume pending Playground first-run flag:', error)
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
