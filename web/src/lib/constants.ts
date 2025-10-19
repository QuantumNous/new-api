/**
 * Application-wide constants
 */

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = 'New API'
export const DEFAULT_LOGO = '/logo.png'

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const

// Skeleton Loading Defaults
export const SKELETON_DEFAULTS = {
  TITLE_WIDTH: 120,
  TITLE_HEIGHT: 24,
  NAV_WIDTH: 80,
  NAV_HEIGHT: 16,
  NAV_COUNT: 3,
  MOBILE_NAV_WIDTH: 100,
  MOBILE_NAV_HEIGHT: 20,
  MOBILE_NAV_COUNT: 5,
} as const
