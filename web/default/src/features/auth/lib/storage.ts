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
  AFFILIATE: 'aff:v1',
  LEGACY_AFFILIATE: 'aff',
  STATUS: 'status',
} as const

const AFFILIATE_ATTRIBUTION_TTL_SECONDS = 7 * 24 * 60 * 60

interface AffiliateAttribution {
  code: string
  captured_at: number
  expires_at: number
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
    window.localStorage.removeItem(STORAGE_KEYS.LEGACY_AFFILIATE)
    const stored = window.localStorage.getItem(STORAGE_KEYS.AFFILIATE)
    if (!stored) return ''
    const attribution = JSON.parse(stored) as AffiliateAttribution
    if (
      typeof attribution.code !== 'string' ||
      typeof attribution.expires_at !== 'number' ||
      Math.floor(Date.now() / 1000) >= attribution.expires_at
    ) {
      window.localStorage.removeItem(STORAGE_KEYS.AFFILIATE)
      return ''
    }
    return attribution.code
  } catch {
    window.localStorage.removeItem(STORAGE_KEYS.AFFILIATE)
    return ''
  }
}

/**
 * Save affiliate code to localStorage
 */
export function saveAffiliateCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEYS.LEGACY_AFFILIATE)
    const normalizedCode = code.trim()
    if (!normalizedCode || normalizedCode.length > 32) return
    const capturedAt = Math.floor(Date.now() / 1000)
    const attribution: AffiliateAttribution = {
      code: normalizedCode,
      captured_at: capturedAt,
      expires_at: capturedAt + AFFILIATE_ATTRIBUTION_TTL_SECONDS,
    }
    window.localStorage.setItem(
      STORAGE_KEYS.AFFILIATE,
      JSON.stringify(attribution)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save affiliate code:', error)
  }
}

export function removeAffiliateCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEYS.AFFILIATE)
    window.localStorage.removeItem(STORAGE_KEYS.LEGACY_AFFILIATE)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to remove affiliate code:', error)
  }
}
