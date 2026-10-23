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

const SESSION_REQUIRED_CODES = new Set([
  'session_required',
  'AUTH_UNAUTHORIZED',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_SESSION_REVOKED',
])

export const DESKTOP_CONNECT_PATH = '/desktop/connect'
export const DEFAULT_DESKTOP_DOWNLOAD_URL = 'https://yeschoy.com/download'

export function pageHttpsOrigin(locationLike: {
  protocol: string
  origin: string
}): string | null {
  if (locationLike.protocol !== 'https:') return null
  return locationLike.origin
}

export function buildConnectDeepLink(origin: string, code: string): string {
  const params = new URLSearchParams()
  params.set('origin', origin)
  params.set('code', code)
  return `yeschoy://connect?${params.toString()}`
}

export function normalizeConnectIssueReasonCode(
  code: string | undefined | null,
  httpStatus = 0
): string {
  const normalized = typeof code === 'string' ? code.trim() : ''
  if (SESSION_REQUIRED_CODES.has(normalized)) {
    return 'session_required'
  }
  if (httpStatus === 401) {
    if (!normalized || normalized.startsWith('AUTH_')) {
      return 'session_required'
    }
  }
  return normalized || 'issue_failed'
}

/** Return path after sign-in: same connect page with auto=1. */
export function buildConnectReturnPath(search = ''): string {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  )
  params.set('auto', '1')
  const query = params.toString()
  return query ? `${DESKTOP_CONNECT_PATH}?${query}` : `${DESKTOP_CONNECT_PATH}?auto=1`
}

export function buildSignInUrlForConnect(search = ''): string {
  const redirect = encodeURIComponent(buildConnectReturnPath(search))
  return `/sign-in?redirect=${redirect}`
}

export function shouldAutoConnect(search: {
  auto?: string | boolean | number
}): boolean {
  return search.auto === '1' || search.auto === 1 || search.auto === true
}
