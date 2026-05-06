import type { UserProfile, UserSettings } from '../types'

// ============================================================================
// Profile Formatting Utilities
// ============================================================================

/**
 * Parse user settings from JSON string
 */
export function parseUserSettings(settingsJson?: string): UserSettings {
  if (!settingsJson) return {}

  try {
    return JSON.parse(settingsJson) as UserSettings
  } catch {
    return {}
  }
}

/**
 * Get display name or fallback to username
 */
export function getDisplayName(user?: UserProfile): string {
  if (!user) return ''
  return user.display_name || user.username
}

/**
 * Get user initials for avatar
 */
export function getUserInitials(user?: UserProfile): string {
  if (!user) return '?'
  const name = getDisplayName(user)
  if (!name) return '?'

  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}
