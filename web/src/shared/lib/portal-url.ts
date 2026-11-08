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
 * Portal origins.
 *
 * Both portals are served from one deployment during local development, so the
 * base URLs stay empty by default and every redirect remains a same-origin
 * router path. Setting `VITE_CLIENT_BASE_URL` / `VITE_ADMIN_BASE_URL` to a
 * different origin (for example `https://admin.example.com`) switches the
 * cross-portal redirects to absolute URLs, which is what a subdomain
 * deployment needs.
 */
export type Portal = 'client' | 'admin'

const BASE_URLS: Record<Portal, string | undefined> = {
  client: import.meta.env.VITE_CLIENT_BASE_URL,
  admin: import.meta.env.VITE_ADMIN_BASE_URL,
}

const FALLBACK_ORIGIN = 'http://localhost'

function currentOrigin(): string {
  return typeof window === 'undefined' ? FALLBACK_ORIGIN : window.location.origin
}

function resolveBase(portal: Portal): URL | null {
  const base = BASE_URLS[portal]
  if (!base) return null
  try {
    return new URL(base, currentOrigin())
  } catch {
    return null
  }
}

/** Whether the portal is configured on a different origin from the current one. */
export function isCrossOriginPortal(portal: Portal): boolean {
  const resolved = resolveBase(portal)
  if (!resolved || typeof window === 'undefined') return false
  return resolved.origin !== window.location.origin
}

/**
 * Absolute URL for a path inside the given portal, or the path itself when the
 * portal uses the current origin.
 */
export function portalHref(portal: Portal, path: string): string {
  const resolved = resolveBase(portal)
  if (!resolved) return path
  return new URL(path, resolved).toString()
}
