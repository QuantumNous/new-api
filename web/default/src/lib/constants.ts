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
 * Application-wide constants
 */
import { isAiocDemoMode } from '@/config/aioc-demo-visibility'

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = '昀河星泽词元运营中心'
export const LEGACY_SYSTEM_NAMES = [
  'New API',
  'NEW API',
  'new-api',
  'One API',
  'ONE API',
  'one api',
] as const

const LEGACY_SYSTEM_NAME_LOOKUP = new Set(
  LEGACY_SYSTEM_NAMES.map((name) => name.toLowerCase())
)

/** Display-only: map legacy product names to the branded operations center name. */
export function normalizeSystemName(name?: string | null) {
  if (!name) return DEFAULT_SYSTEM_NAME
  const trimmed = name.trim()
  if (!trimmed) return DEFAULT_SYSTEM_NAME
  if (LEGACY_SYSTEM_NAME_LOOKUP.has(trimmed.toLowerCase())) {
    return DEFAULT_SYSTEM_NAME
  }
  return trimmed
}

/** Cache-bust query for static brand logo / favicon assets. */
export const BRAND_ASSET_VERSION = 'aioc-logo-20260521'

/** @deprecated Use {@link BRAND_ASSET_VERSION}. */
export const BRAND_FAVICON_VERSION = BRAND_ASSET_VERSION

/** Xingze brand mark (`web/default/public/brand/logo.png`). */
export const DEFAULT_AIOC_LOGO = `/brand/logo.png?v=${BRAND_ASSET_VERSION}`

/** Browser tab icon (`web/default/public/brand/favicon.png`). */
export const DEFAULT_AIOC_FAVICON = `/brand/favicon.png?v=${BRAND_ASSET_VERSION}`

export const BRAND_LOGO_URL = DEFAULT_AIOC_LOGO

export const BRAND_FAVICON_URL = DEFAULT_AIOC_FAVICON

export const BRAND_APPLE_TOUCH_ICON_URL = `/apple-touch-icon.png?v=${BRAND_ASSET_VERSION}`

/** Legacy colorful default; map to {@link DEFAULT_AIOC_LOGO} in the UI layer only. */
export const LEGACY_LOGO_URL = '/logo.png'

export const DEFAULT_LOGO = DEFAULT_AIOC_LOGO

export const DEFAULT_FAVICON = DEFAULT_AIOC_FAVICON

const LEGACY_LOGO_PATHS = new Set([
  '/logo.png',
  '/favicon.png',
  '/favicon.ico',
])

const LEGACY_LOGO_MARKERS = [
  'new-api',
  'one-api',
  'logo-small',
  'favicon.ico',
  'favicon.png',
] as const

function pathnameOf(value: string): string {
  try {
    return new URL(value, 'http://local').pathname.toLowerCase()
  } catch {
    return value.split('?')[0]?.toLowerCase() ?? value.toLowerCase()
  }
}

function isBrandLogoPath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  return path === '/brand/logo.png' || path.endsWith('/brand/logo.png')
}

function isBrandAssetPath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  return (
    isBrandLogoPath(path) ||
    path === '/brand/favicon.png' ||
    path.endsWith('/brand/favicon.png') ||
    path.startsWith('/brand/')
  )
}

function isLegacyLogoReference(value: string): boolean {
  const lower = value.toLowerCase()
  if (LEGACY_LOGO_MARKERS.some((marker) => lower.includes(marker))) {
    return true
  }

  const path = pathnameOf(value)
  if (LEGACY_LOGO_PATHS.has(path)) return true
  if (path.endsWith('/logo.png') && !path.includes('/brand/')) return true
  if (path.includes('favicon')) return true
  if (lower === 'logo.png' || lower.endsWith('/logo.png')) return true
  if (lower.endsWith('.ico')) return true
  return false
}

function isCustomHttpLogo(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  if (isLegacyLogoReference(value)) return false
  if (isBrandAssetPath(pathnameOf(value))) return false
  return true
}

/**
 * Presentation-only: normalize API / cache / options Logo values for UI rendering.
 * Legacy New API assets map to the versioned Xingze brand; explicit http(s) custom logos are kept.
 */
export function normalizeBrandLogoUrl(input?: string | null): string {
  if (isAiocDemoMode()) return DEFAULT_AIOC_LOGO

  const trimmed = input?.trim()
  if (!trimmed) return DEFAULT_AIOC_LOGO

  if (isCustomHttpLogo(trimmed)) {
    return trimmed
  }

  const path = pathnameOf(trimmed)

  if (isBrandAssetPath(path) || isLegacyLogoReference(trimmed)) {
    return DEFAULT_AIOC_LOGO
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return DEFAULT_AIOC_LOGO
  }

  return trimmed
}

/** @deprecated Use {@link normalizeBrandLogoUrl}; kept for existing imports. */
export const resolveSystemLogoUrl = normalizeBrandLogoUrl

/** Presentation-only: tab favicon always uses the versioned Xingze brand asset. */
export function resolveFaviconUrl(_logo?: string | null): string {
  return BRAND_FAVICON_URL
}

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const
