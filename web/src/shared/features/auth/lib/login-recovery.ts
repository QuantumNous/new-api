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
import { clearAuthentication } from '@/shared/lib/auth-session'
import { SESSION_HINT_COOKIE_NAME } from '@/shared/lib/session-hint'

/**
 * Legacy builds persisted auth payloads in localStorage. Current builds keep
 * the session in memory only, but those old keys survive cache migrations and
 * must not leak into a fresh sign-in.
 */
const LEGACY_AUTH_STORAGE_KEYS = [
  'auth',
  'new-api-auth',
  'user',
  'uid',
  'token',
] as const

const OAUTH_REDIRECT_SESSION_PREFIX = 'oauth_login_redirect:'

/**
 * Drop client-side authentication state without contacting the server.
 *
 * Used by the login route and its error boundary: if the session cannot be
 * confirmed, every local trace of it is stale by definition. The HttpOnly
 * refresh cookie is intentionally untouched (JavaScript cannot clear it and a
 * transient network failure must not force a password reset); the readable
 * session hint is removed so the next bootstrap does not wait on a dead
 * session.
 */
export function clearStaleLoginState(): void {
  try {
    clearAuthentication(false)
  } catch {
    // The in-memory store is always available, but recovery must not throw.
  }

  if (typeof window !== 'undefined') {
    try {
      for (const key of LEGACY_AUTH_STORAGE_KEYS) {
        window.localStorage.removeItem(key)
      }
    } catch {
      // Storage can be blocked in private mode.
    }

    try {
      const staleKeys: string[] = []
      for (let index = 0; index < window.sessionStorage.length; index += 1) {
        const key = window.sessionStorage.key(index)
        if (key?.startsWith(OAUTH_REDIRECT_SESSION_PREFIX)) {
          staleKeys.push(key)
        }
      }
      for (const key of staleKeys) {
        window.sessionStorage.removeItem(key)
      }
    } catch {
      // Session storage is also optional.
    }
  }

  if (typeof document !== 'undefined') {
    try {
      document.cookie = `${SESSION_HINT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
    } catch {
      // Cookie access can be blocked by browser privacy settings.
    }
  }
}
