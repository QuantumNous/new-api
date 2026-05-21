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
import { DASHBOARD_DEFAULT_SECTION } from '@/features/dashboard/section-registry'

const AUTH_OR_ERROR_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/otp',
  '/forgot-password',
  '/reset-password',
  '/setup',
  '/500',
  '/503',
  '/403',
  '/404',
] as const

export type PostLoginRedirect =
  | { kind: 'dashboard'; section: string }
  | { kind: 'path'; pathname: string }

function defaultDashboardRedirect(): PostLoginRedirect {
  return { kind: 'dashboard', section: DASHBOARD_DEFAULT_SECTION }
}

function normalizeRedirectInput(redirectTo?: string): string | null {
  const trimmed = redirectTo?.trim()
  if (!trimmed) return null

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      if (typeof window === 'undefined') return null
      const url = new URL(trimmed)
      if (url.origin !== window.location.origin) return null
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return null
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function isBlockedRedirectPath(pathname: string): boolean {
  const path = pathname.toLowerCase()
  return AUTH_OR_ERROR_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )
}

/**
 * Resolve a safe internal redirect after login.
 * Invalid, external, or auth/error targets fall back to the operations overview.
 */
export function resolvePostLoginRedirect(
  redirectTo?: string
): PostLoginRedirect {
  const normalized = normalizeRedirectInput(redirectTo)
  if (!normalized) return defaultDashboardRedirect()

  const pathname = normalized.split(/[?#]/)[0] || normalized
  if (!pathname.startsWith('/') || isBlockedRedirectPath(pathname)) {
    return defaultDashboardRedirect()
  }

  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return defaultDashboardRedirect()
  }

  return { kind: 'path', pathname: normalized }
}
