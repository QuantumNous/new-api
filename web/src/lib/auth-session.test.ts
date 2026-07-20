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
import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { QueryClient } from '@tanstack/react-query'

import { useAuthStore, type AuthBundle } from '../stores/auth-store'
import {
  applyAuthRotation,
  bootstrapAuthentication,
  clearAuthenticatedClientState,
  createRefreshRunner,
  isAuthBundle,
  type AuthRefreshRuntime,
} from './auth-session'

const bundle: AuthBundle = {
  access_token: 'access-token',
  token_type: 'Bearer',
  access_expires_at: Math.floor(Date.now() / 1000) + 600,
  user: {
    id: 42,
    username: 'test-user',
    role: 1,
  },
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

afterEach(() => {
  useAuthStore.getState().auth.reset('idle')
})

describe('authentication session coordination', () => {
  test('bootstrap distinguishes a completed anonymous check from an active session', async () => {
    useAuthStore.getState().auth.reset('complete')
    assert.deepEqual(await bootstrapAuthentication(), { kind: 'anonymous' })

    useAuthStore.getState().auth.setBundle(bundle)
    assert.deepEqual(await bootstrapAuthentication(), {
      kind: 'authenticated',
      bundle,
    })
  })

  test('a session mismatch clears only local state and retries without the stale SID', async () => {
    let expectedSID: string | undefined = bundle.session.sid
    const requestedSIDs: Array<string | undefined> = []
    const clears: Array<[boolean, string | undefined]> = []
    const accepted: AuthBundle[] = []
    const runtime: AuthRefreshRuntime = {
      request: async (sid) => {
        requestedSIDs.push(sid)
        if (requestedSIDs.length === 1) {
          return {
            status: 409,
            data: { code: 'AUTH_SESSION_MISMATCH' },
          }
        }
        return { status: 200, data: { success: true, data: bundle } }
      },
      getExpectedSID: () => expectedSID,
      parseBundle: (value) => (isAuthBundle(value) ? value : null),
      acceptBundle: (acceptedBundle) => accepted.push(acceptedBundle),
      clear: (synchronizeTabs, bootstrapState) => {
        clears.push([synchronizeTabs, bootstrapState])
        expectedSID = undefined
      },
      markTransient: () => undefined,
      wait: async () => undefined,
    }

    const outcome = await createRefreshRunner(runtime)()

    assert.equal(outcome.kind, 'authenticated')
    assert.deepEqual(requestedSIDs, [bundle.session.sid, undefined])
    assert.deepEqual(clears, [[false, 'idle']])
    assert.deepEqual(accepted, [bundle])
  })

  test('a rejected refresh confirms anonymous state and synchronizes sign-out', async () => {
    const clears: Array<[boolean, string | undefined]> = []
    const runtime: AuthRefreshRuntime = {
      request: async () => ({ status: 401 }),
      getExpectedSID: () => bundle.session.sid,
      parseBundle: () => null,
      acceptBundle: () => undefined,
      clear: (synchronizeTabs, bootstrapState) => {
        clears.push([synchronizeTabs, bootstrapState])
      },
      markTransient: () => undefined,
      wait: async () => undefined,
    }

    assert.deepEqual(await createRefreshRunner(runtime)(), {
      kind: 'anonymous',
    })
    assert.deepEqual(clears, [[true, undefined]])
  })

  test('a temporary refresh failure remains retryable without clearing the session', async () => {
    let transientCount = 0
    let clearCount = 0
    const runtime: AuthRefreshRuntime = {
      request: async () => ({ status: 503, error: new Error('unavailable') }),
      getExpectedSID: () => bundle.session.sid,
      parseBundle: () => null,
      acceptBundle: () => undefined,
      clear: () => {
        clearCount += 1
      },
      markTransient: () => {
        transientCount += 1
      },
      wait: async () => undefined,
    }

    const outcome = await createRefreshRunner(runtime)()

    assert.equal(outcome.kind, 'transient_error')
    assert.equal(clearCount, 0)
    assert.equal(transientCount, 1)
  })

  test('an exhausted refresh race clears the unusable local session', async () => {
    const requestedDelays: number[] = []
    const clears: Array<[boolean, string | undefined]> = []
    const runtime: AuthRefreshRuntime = {
      request: async () => ({
        status: 409,
        data: { code: 'AUTH_REFRESH_RACE' },
      }),
      getExpectedSID: () => bundle.session.sid,
      parseBundle: () => null,
      acceptBundle: () => undefined,
      clear: (synchronizeTabs, bootstrapState) => {
        clears.push([synchronizeTabs, bootstrapState])
      },
      markTransient: () => undefined,
      wait: async (delay) => {
        requestedDelays.push(delay)
      },
    }

    assert.deepEqual(await createRefreshRunner(runtime)(), {
      kind: 'out_of_sync',
      code: 'AUTH_REFRESH_RACE',
    })
    assert.deepEqual(requestedDelays, [80, 200, 500])
    assert.deepEqual(clears, [[false, undefined]])
  })

  test('an unexpected successful response is treated as out of sync', async () => {
    let cleared = false
    const runtime: AuthRefreshRuntime = {
      request: async () => ({ status: 200, data: { success: true } }),
      getExpectedSID: () => bundle.session.sid,
      parseBundle: () => null,
      acceptBundle: () => undefined,
      clear: () => {
        cleared = true
      },
      markTransient: () => undefined,
      wait: async () => undefined,
    }

    assert.deepEqual(await createRefreshRunner(runtime)(), {
      kind: 'out_of_sync',
      code: 'AUTH_INVALID_REFRESH_RESPONSE',
    })
    assert.equal(cleared, true)
  })

  test('a refresh response cannot restore credentials after a newer auth operation', async () => {
    let current = true
    let accepted = false
    const runtime: AuthRefreshRuntime = {
      request: async () => {
        current = false
        return { status: 200, data: { success: true, data: bundle } }
      },
      getExpectedSID: () => bundle.session.sid,
      parseBundle: (value) => (isAuthBundle(value) ? value : null),
      acceptBundle: () => {
        accepted = true
      },
      clear: () => undefined,
      markTransient: () => undefined,
      wait: async () => undefined,
      isCurrent: () => current,
    }

    const outcome = await createRefreshRunner(runtime)()

    assert.equal(outcome.kind, 'transient_error')
    assert.equal(accepted, false)
  })

  test('explicit rotations update only the current session', () => {
    useAuthStore.getState().auth.setBundle(bundle)
    applyAuthRotation({
      access_token: 'rotated-token',
      token_type: 'Bearer',
      access_expires_at: bundle.access_expires_at + 60,
      session: { ...bundle.session, last_active_at: 200 },
    })

    assert.equal(useAuthStore.getState().auth.accessToken, 'rotated-token')
    assert.strictEqual(useAuthStore.getState().auth.user, bundle.user)

    assert.throws(
      () =>
        applyAuthRotation({
          access_token: 'non-bearer-token',
          token_type: 'Custom',
          access_expires_at: bundle.access_expires_at + 120,
          session: bundle.session,
        }),
      /Invalid authentication rotation response/
    )
    assert.throws(
      () =>
        applyAuthRotation({
          access_token: 'non-current-token',
          token_type: 'Bearer',
          access_expires_at: bundle.access_expires_at + 120,
          session: { ...bundle.session, current: false },
        }),
      /Invalid authentication rotation response/
    )

    assert.throws(
      () =>
        applyAuthRotation({
          access_token: 'wrong-session-token',
          token_type: 'Bearer',
          access_expires_at: bundle.access_expires_at + 120,
          session: { ...bundle.session, sid: 'session-b' },
        }),
      /session mismatch/
    )
    assert.equal(useAuthStore.getState().auth.accessToken, 'rotated-token')
  })

  test('sign-out clears user-scoped query, mutation, and authentication state', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['account', bundle.user.id], {
      username: bundle.user.username,
    })
    queryClient.getMutationCache().build(queryClient, {
      mutationKey: ['account', bundle.user.id, 'update'],
      mutationFn: async () => undefined,
    })
    useAuthStore.getState().auth.setBundle(bundle)
    useAuthStore.getState().auth.setPending2FAFlowToken('pending-flow')

    clearAuthenticatedClientState(queryClient, false)

    assert.equal(queryClient.getQueryCache().getAll().length, 0)
    assert.equal(queryClient.getMutationCache().getAll().length, 0)
    assert.equal(useAuthStore.getState().auth.user, null)
    assert.equal(useAuthStore.getState().auth.accessToken, null)
    assert.equal(useAuthStore.getState().auth.session, null)
    assert.equal(useAuthStore.getState().auth.pending2FAFlowToken, null)
    assert.equal(useAuthStore.getState().auth.bootstrapState, 'complete')

    const nextBundle: AuthBundle = {
      ...bundle,
      access_token: 'next-user-token',
      user: { id: 84, username: 'next-user', role: 1 },
      session: { ...bundle.session, sid: 'session-b' },
    }
    useAuthStore.getState().auth.setBundle(nextBundle)
    assert.equal(
      queryClient.getQueryData(['account', bundle.user.id]),
      undefined
    )
  })
})
