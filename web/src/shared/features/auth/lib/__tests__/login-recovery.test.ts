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
import { afterEach, describe, expect, it } from 'vitest'

import { ROLE } from '@/shared/lib/roles'
import { useAuthStore, type AuthBundle } from '@/shared/stores/auth-store'

import { clearStaleLoginState } from '../login-recovery'

function seedAuthenticatedUser(): void {
  const bundle: AuthBundle = {
    access_token: 'stale-token',
    token_type: 'Bearer',
    access_expires_at: 9999999999,
    user: { id: 7, username: 'stale-user', role: ROLE.USER },
    session: {
      sid: 'stale-session',
      current: true,
      login_method: 'password',
      ip: '',
      user_agent: '',
      created_at: 1,
      last_active_at: 1,
      expires_at: 9999999999,
    },
  }
  useAuthStore.getState().auth.setBundle(bundle)
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore.getState().auth.reset('idle')
  document.cookie = 'new_api_has_session=; Max-Age=0; Path=/'
})

describe('clearStaleLoginState', () => {
  it('clears in-memory auth and legacy persisted auth keys', () => {
    seedAuthenticatedUser()
    localStorage.setItem('user', '{"id":7}')
    localStorage.setItem('uid', '7')
    localStorage.setItem('auth', '{"token":"x"}')
    localStorage.setItem('new-api-auth', 'x')
    localStorage.setItem('token', 'x')

    clearStaleLoginState()

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBeNull()
    for (const key of ['user', 'uid', 'auth', 'new-api-auth', 'token']) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('keeps unrelated preferences and only clears abandoned OAuth markers', () => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('i18nextLng', 'en')
    sessionStorage.setItem('oauth_login_redirect:abc', '/app/keys')
    sessionStorage.setItem('unrelated', 'keep')

    clearStaleLoginState()

    expect(localStorage.getItem('theme')).toBe('dark')
    expect(localStorage.getItem('i18nextLng')).toBe('en')
    expect(sessionStorage.getItem('oauth_login_redirect:abc')).toBeNull()
    expect(sessionStorage.getItem('unrelated')).toBe('keep')
  })

  it('removes the readable session hint cookie', () => {
    document.cookie = 'new_api_has_session=1; Path=/'
    expect(document.cookie).toContain('new_api_has_session=1')

    clearStaleLoginState()

    expect(document.cookie).not.toContain('new_api_has_session=1')
  })
})
