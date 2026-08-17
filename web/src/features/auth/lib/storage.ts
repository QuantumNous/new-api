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
  AFFILIATE: 'ren2hub.affiliate-attribution.v1',
  STATUS: 'status',
} as const

const AFFILIATE_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface StoredAffiliateAttribution {
  code: string
  expiresAt: number
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
    const raw = window.localStorage.getItem(STORAGE_KEYS.AFFILIATE)
    if (!raw) return ''
    const value = JSON.parse(raw) as Partial<StoredAffiliateAttribution>
    if (
      typeof value.code !== 'string' ||
      value.code.length === 0 ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now()
    ) {
      clearAffiliateCode()
      return ''
    }
    return value.code
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to get affiliate code:', error)
    clearAffiliateCode()
    return ''
  }
}

/**
 * Save affiliate code to localStorage
 */
export function saveAffiliateCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    const normalized = code.trim()
    if (!normalized) return
    const value: StoredAffiliateAttribution = {
      code: normalized,
      expiresAt: Date.now() + AFFILIATE_TTL_MS,
    }
    window.localStorage.setItem(STORAGE_KEYS.AFFILIATE, JSON.stringify(value))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save affiliate code:', error)
  }
}

export function clearAffiliateCode(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEYS.AFFILIATE)
    window.localStorage.removeItem('aff')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear affiliate code:', error)
  }
}
