import { describe, expect, it } from 'vitest'

import {
  DEMO_UID_STORAGE_KEY,
  DEMO_USER_STORAGE_KEY,
  readDemoUser,
  writeDemoUser,
} from '@/api/demoStorage'
import type { UserInfo } from '@/types/auth'

const user: UserInfo = {
  id: 7,
  username: 'demo',
  display_name: 'Demo User',
  email: 'demo@example.com',
  role: 1,
  quota: 100,
  used_quota: 10,
}

describe('demo identity storage', () => {
  it('uses only the ren2hub_demo namespace and validates the schema', () => {
    writeDemoUser(user)

    expect(readDemoUser()).toEqual(user)
    expect(localStorage.getItem(DEMO_UID_STORAGE_KEY)).toBe('7')
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('uid')).toBeNull()
  })

  it('clears malformed persisted identity', () => {
    localStorage.setItem(
      DEMO_USER_STORAGE_KEY,
      JSON.stringify({ id: 7, role: 100 })
    )
    expect(readDemoUser()).toBeNull()
    expect(localStorage.getItem(DEMO_USER_STORAGE_KEY)).toBeNull()
  })

  it('rejects a locally forged privileged demo identity', () => {
    localStorage.setItem(
      DEMO_USER_STORAGE_KEY,
      JSON.stringify({
        ...user,
        role: 100,
        permissions: { admin_permissions: { channel: { read: true } } },
      })
    )

    expect(readDemoUser()).toBeNull()
    expect(localStorage.getItem(DEMO_USER_STORAGE_KEY)).toBeNull()
  })
})
