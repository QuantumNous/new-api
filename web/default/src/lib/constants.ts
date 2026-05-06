/**
 * Application-wide constants
 */

import {
  getDefaultLogo,
  getDefaultSystemName,
} from '@/branding'

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = getDefaultSystemName()
export const DEFAULT_LOGO = getDefaultLogo()

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const
