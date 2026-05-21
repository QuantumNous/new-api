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
 * AIOC customer-demo visibility (presentation layer only).
 *
 * - Hides navigation / settings entry points unsuitable for demos.
 * - Does NOT remove routes, components, APIs, or configuration keys.
 * - Set AIOC_DEMO_MODE to false (or remove keys from AIOC_HIDDEN_NAV_KEYS) to restore entries.
 */
export const AIOC_DEMO_MODE = true

/** Normalized nav / section identifiers hidden while demo mode is on. */
export const AIOC_HIDDEN_NAV_KEYS = new Set([
  'docs',
  'documentation',
  'api-docs',
  'integration-docs',
  'oauth',
  'oauth-integrations',
  'oauth-integration',
  'custom-oauth',
  'uptime-kuma',
  'update-checker',
  'model-deployment',
  'ionet',
  'io-net',
  'io-net-deployment',
  'open-in-chat',
  'third-party-chat',
  'classic-frontend',
  'legacy-frontend',
  'github-release',
  'open-release',
  'github',
])

/** URL path fragments; direct URL access may still work. */
const AIOC_HIDDEN_URL_FRAGMENTS = [
  '/auth/oauth',
  '/auth/custom-oauth',
  '/uptime-kuma',
  '/update-checker',
  '/model-deployment',
  '/docs',
] as const

export function isAiocDemoMode(): boolean {
  return AIOC_DEMO_MODE
}

export function normalizeAiocNavKey(keyOrId: string): string {
  return keyOrId
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function isAiocNavHidden(keyOrId: string): boolean {
  if (!AIOC_DEMO_MODE) return false
  const key = normalizeAiocNavKey(keyOrId)
  if (!key) return false
  return AIOC_HIDDEN_NAV_KEYS.has(key)
}

export function isAiocNavUrlHidden(url: string): boolean {
  if (!AIOC_DEMO_MODE) return false
  const normalized = url.trim().toLowerCase()
  if (!normalized) return false
  return AIOC_HIDDEN_URL_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment)
  )
}

export function isAiocSectionNavItemHidden(url: string): boolean {
  if (!AIOC_DEMO_MODE) return false
  if (isAiocNavUrlHidden(url)) return true
  const segment = url.split('/').filter(Boolean).pop() ?? ''
  return isAiocNavHidden(segment)
}

/** Filter sidebar / settings nav items ({ url }) for demo mode. */
export function filterAiocDemoNavItems<T extends { url: string }>(
  items: T[]
): T[] {
  if (!AIOC_DEMO_MODE) return items
  return items.filter((item) => !isAiocSectionNavItemHidden(item.url))
}

/** Top header module keys from HeaderNavModules / useTopNavLinks. */
export function isAiocHeaderNavModuleHidden(
  moduleKey: 'home' | 'console' | 'pricing' | 'rankings' | 'docs' | 'about'
): boolean {
  if (!AIOC_DEMO_MODE) return false
  return isAiocNavHidden(moduleKey)
}

/**
 * Sidebar header brand (logo + system name) duplicates the top app bar; hide in demo layout.
 */
export function isAiocSidebarBrandHidden(): boolean {
  return AIOC_DEMO_MODE
}
