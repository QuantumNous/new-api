import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { readDemoUser, writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { useAuthStore } from '@/stores/auth'

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
      group: 'default',
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
