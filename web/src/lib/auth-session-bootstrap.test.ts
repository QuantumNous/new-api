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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore, type AuthBundle } from '../stores/auth-store'
import { SESSION_HINT_COOKIE_NAME } from './session-hint'

const post = vi.fn()

vi.mock('axios', () => ({
  default: {
    create: () => ({ post }),
    isAxiosError: () => false,
  },
}))

const { bootstrapAuthentication, resolveAuthentication } = await import(
  './auth-session'
)

const bundle: AuthBundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: Math.floor(Date.now() / 1000) + 600,
  user: { id: 42, username: 'test-user', role: 1 },
  session: {
    sid: 'session-a',
    current: true,
    login_method: 'password',
    ip: '127.0.0.1',
    user_agent: 'test',
    created_at: 100,
    last_active_at: 100,
    expires_at: 1000,
  },
}

function setSessionHint(present: boolean): void {
  document.cookie = present
    ? `${SESSION_HINT_COOKIE_NAME}=1`
    : `${SESSION_HINT_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue({ status: 200, data: { success: true, data: bundle } })
  setSessionHint(false)
  useAuthStore.getState().auth.reset('idle')
})

afterEach(() => {
  setSessionHint(false)
  useAuthStore.getState().auth.reset('idle')
})

describe('cold boot on the public path', () => {
  // The point of the whole change: an anonymous visitor must not pay for a
  // refresh that cannot succeed, because that request also spends a slot of the
  // IP-keyed CriticalRateLimit budget shared with everyone behind their address.
  test('skips the doomed refresh when the server reports no session', async () => {
    expect(await bootstrapAuthentication()).toEqual({ kind: 'anonymous' })
    expect(post).not.toHaveBeenCalled()
  })

  // The skip must stay a deferral, not a verdict. Recording it as a finished
  // check would make every later caller trust a conclusion the server never
  // gave, which is what would turn a cleared cookie jar into a lockout.
  test('leaves the bootstrap state open so a later caller still verifies', async () => {
    await bootstrapAuthentication()
    expect(useAuthStore.getState().auth.bootstrapState).not.toBe('complete')
  })

  test('refreshes when the server reports a session exists', async () => {
    setSessionHint(true)

    expect(await bootstrapAuthentication()).toEqual({
      kind: 'authenticated',
      bundle,
    })
    expect(post).toHaveBeenCalledTimes(1)
  })

  // A stale in-memory identity is a real inconsistency that only the server can
  // settle, so the hint must not suppress it.
  test('refreshes a stale in-memory session even without a hint', async () => {
    useAuthStore.getState().auth.setBundle({
      ...bundle,
      access_expires_at: Math.floor(Date.now() / 1000) - 60,
    })

    await bootstrapAuthentication()
    expect(post).toHaveBeenCalledTimes(1)
  })

  test('returns an in-memory session without any request', async () => {
    useAuthStore.getState().auth.setBundle(bundle)

    expect(await bootstrapAuthentication()).toEqual({
      kind: 'authenticated',
      bundle,
    })
    expect(post).not.toHaveBeenCalled()
  })
})

describe('routes that act on the answer', () => {
  // This is what saves a user holding a valid Refresh Cookie but no hint — every
  // session that predates the hint cookie, plus anyone who cleared storage for
  // `/` alone — from being asked for their password again.
  test('resolve reaches the server even when no hint is present', async () => {
    expect(await resolveAuthentication()).toEqual({
      kind: 'authenticated',
      bundle,
    })
    expect(post).toHaveBeenCalledTimes(1)
  })

  // The sequence a hintless returning user actually walks: public page first,
  // then a guard. The skip must not poison the guard's answer.
  test('a guard recovers the session the public path skipped', async () => {
    expect(await bootstrapAuthentication()).toEqual({ kind: 'anonymous' })
    expect(post).not.toHaveBeenCalled()

    expect(await resolveAuthentication()).toEqual({
      kind: 'authenticated',
      bundle,
    })
    expect(useAuthStore.getState().auth.user).toEqual(bundle.user)
  })

  // Once the server has confirmed anonymity, repeat navigations must stop
  // asking; otherwise every guard hit would restore the cost just removed.
  test('a confirmed anonymous result is not re-verified', async () => {
    post.mockResolvedValue({ status: 401, data: { success: false } })

    expect(await resolveAuthentication()).toEqual({ kind: 'anonymous' })
    expect(post).toHaveBeenCalledTimes(1)

    expect(await resolveAuthentication()).toEqual({ kind: 'anonymous' })
    expect(post).toHaveBeenCalledTimes(1)
  })
})
