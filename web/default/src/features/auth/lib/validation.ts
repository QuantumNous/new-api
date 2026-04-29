import { BACKUP_CODE_REGEX, OTP_REGEX } from '../constants'

/**
 * Validation utilities for authentication forms
 */

// ============================================================================
// OTP Validation
// ============================================================================

/**
 * Validate OTP code (6 digits)
 */
export function isValidOTP(code: string): boolean {
  return OTP_REGEX.test(code)
}

/**
 * Validate backup code (XXXX-XXXX format)
 */
export function isValidBackupCode(code: string): boolean {
  return BACKUP_CODE_REGEX.test(code)
}

/**
 * Format backup code with hyphen (XXXX-XXXX)
 */
export function formatBackupCode(value: string): string {
  // Remove all non-alphanumeric characters and convert to uppercase
  let cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')

  // Limit to 8 characters
  if (cleaned.length > 8) {
    cleaned = cleaned.slice(0, 8)
  }

  // Add hyphen after 4th character
  if (cleaned.length > 4) {
    return cleaned.slice(0, 4) + '-' + cleaned.slice(4)
  }

  return cleaned
}

/**
 * Remove hyphens from backup code before sending to server
 */
export function cleanBackupCode(code: string): string {
  return code.replace(/-/g, '')
}

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Basic email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
