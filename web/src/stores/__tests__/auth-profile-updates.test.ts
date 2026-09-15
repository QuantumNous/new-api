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
import { afterEach, describe, expect, test } from 'vitest'

import { createTestAuthBundle } from '@/test-utils/auth-bundle'

import { useAuthStore } from '../auth-store'

afterEach(() => useAuthStore.getState().auth.reset())

describe('session-bound profile updates', () => {
  test('a response arriving after sign-out cannot restore an unauthenticated user', () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle(bundle)
    const pendingAuth = useAuthStore.getState().auth

    pendingAuth.reset()
    pendingAuth.setUser({ ...bundle.user, language: 'ja' })

    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(useAuthStore.getState().auth.accessToken).toBeNull()
    expect(useAuthStore.getState().auth.session).toBeNull()
  })

  test('a response from another account cannot replace the current user', () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle(bundle)

    useAuthStore.getState().auth.setUser({ id: 99, username: 'other', role: 1 })

    expect(useAuthStore.getState().auth.user).toEqual(bundle.user)
  })

  test('a response from a previous session of the same account is ignored', () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle(bundle)
    const pendingAuth = useAuthStore.getState().auth
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      session: { ...bundle.session, sid: 'new-session' },
    })

    pendingAuth.setUser({ ...bundle.user, language: 'ja' }, bundle.session.sid)

    expect(useAuthStore.getState().auth.user).toEqual(bundle.user)
    expect(useAuthStore.getState().auth.session?.sid).toBe('new-session')
  })

  test('the current session can update its profile without changing credentials', () => {
    const bundle = createTestAuthBundle()
    useAuthStore.getState().auth.setBundle(bundle)
    const user = { ...bundle.user, language: 'ja' }

    useAuthStore.getState().auth.setUser(user, bundle.session.sid)

    expect(useAuthStore.getState().auth.user).toEqual(user)
    expect(useAuthStore.getState().auth.accessToken).toBe(bundle.access_token)
    expect(useAuthStore.getState().auth.session).toEqual(bundle.session)
  })
})
