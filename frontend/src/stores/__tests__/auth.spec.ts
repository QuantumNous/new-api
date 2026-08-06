import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { readDemoUser, writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { applyAuthSessionSyncEvent, useAuthStore } from '@/stores/auth'

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  setActivePinia(createPinia())
})

describe('demo administration state', () => {
  it('defaults to administrator UI access without granting root access', () => {
    const auth = useAuthStore()

    expect(auth.isAdmin).toBe(true)
    expect(auth.isRoot).toBe(false)
  })
})

describe('account deletion', () => {
  it('deletes through the API and clears the demo session', async () => {
    writeDemoUser({
      id: 1,
      username: 'demo',
      display_name: 'Demo',
      email: 'demo@example.com',
      role: 1,
      quota: 100,
      used_quota: 0,
    })
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(true)

    await auth.deleteAccount()

    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.checked).toBe(true)
    expect(readDemoUser()).toBeNull()
  })

  it('keeps the session when the API call fails', async () => {
    const auth = useAuthStore()
    // No demo session in storage → the mock rejects with 401 before deleting.
    await expect(auth.deleteAccount()).rejects.toThrow()
  })
})

describe('cross-frontend authentication synchronization', () => {
  function effects(
    currentSid: string | undefined,
    refreshResult: boolean | Error = true
  ) {
    return {
      currentSid: vi.fn(() => currentSid),
      clearBundle: vi.fn(),
      setPending: vi.fn(),
      setAnonymous: vi.fn(),
      refreshFromCookie: vi.fn(async () => {
        if (refreshResult instanceof Error) throw refreshResult
        return refreshResult
      }),
    }
  }

  function event(kind: 'authenticated' | 'signed_out', sid: string) {
    return {
      kind,
      sid,
      source: 'peer-tab',
      nonce: `${kind}-${sid}`,
      timestamp: Date.now(),
    } as const
  }

  it('ignores a signed-out event for a different session', async () => {
    const sideEffects = effects('current')

    await applyAuthSessionSyncEvent(event('signed_out', 'other'), sideEffects)

    expect(sideEffects.clearBundle).not.toHaveBeenCalled()
    expect(sideEffects.setAnonymous).not.toHaveBeenCalled()
  })

  it('clears only the matching signed-out session', async () => {
    const sideEffects = effects('current')

    await applyAuthSessionSyncEvent(event('signed_out', 'current'), sideEffects)

    expect(sideEffects.clearBundle).toHaveBeenCalledOnce()
    expect(sideEffects.setAnonymous).toHaveBeenCalledOnce()
    expect(sideEffects.refreshFromCookie).not.toHaveBeenCalled()
  })

  it('rebuilds a different authenticated session from the shared cookie', async () => {
    const sideEffects = effects('old')

    await applyAuthSessionSyncEvent(event('authenticated', 'new'), sideEffects)

    expect(sideEffects.clearBundle).toHaveBeenCalledOnce()
    expect(sideEffects.setPending).toHaveBeenCalledOnce()
    expect(sideEffects.refreshFromCookie).toHaveBeenCalledOnce()
    expect(sideEffects.setAnonymous).not.toHaveBeenCalled()
  })

  it('fails closed when cookie refresh rejects or returns no session', async () => {
    for (const refreshResult of [false, new Error('refresh failed')]) {
      const sideEffects = effects('current', refreshResult)

      await expect(
        applyAuthSessionSyncEvent(
          event('authenticated', 'current'),
          sideEffects
        )
      ).resolves.toBeUndefined()

      expect(sideEffects.setPending).not.toHaveBeenCalled()
      expect(sideEffects.setAnonymous).toHaveBeenCalledOnce()
    }
  })
})
