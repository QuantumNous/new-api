import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('subscription store cache and identity boundaries', () => {
  it('deduplicates concurrent loads and caches a successful snapshot', async () => {
    const auth = useAuthStore()
    auth.persist({
      id: 7,
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      role: 1,
      quota: 0,
      used_quota: 0,
    })
    const store = useSubscriptionStore()
    const loader = vi.fn(async () => ({
      plans: [],
      subscription: null,
      trafficPacks: [],
    }))

    await Promise.all([store.load(7, loader), store.load(7, loader)])
    await store.load(7, loader)

    expect(loader).toHaveBeenCalledOnce()
    expect(store.loadedUserId).toBe(7)
    expect(store.loading).toBe(false)
  })

  it('clears cached data when the authenticated identity changes', async () => {
    const auth = useAuthStore()
    auth.persist({
      id: 7,
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      role: 1,
      quota: 0,
      used_quota: 0,
    })
    const store = useSubscriptionStore()
    await store.load(7, async () => ({
      plans: [],
      subscription: null,
      trafficPacks: [],
    }))

    auth.persist({
      id: 8,
      username: 'bob',
      display_name: 'Bob',
      email: 'bob@example.com',
      role: 1,
      quota: 0,
      used_quota: 0,
    })
    await nextTick()

    expect(store.loadedUserId).toBeNull()
    expect(store.loadedAt).toBe(0)
  })

  it('does not reuse an in-flight request across user identities', async () => {
    const store = useSubscriptionStore()
    let releaseFirst: (() => void) | undefined
    const first = store.load(
      7,
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({ plans: [], subscription: null, trafficPacks: [] })
        })
    )
    const secondLoader = vi.fn(async () => ({
      plans: [],
      subscription: null,
      trafficPacks: [],
    }))

    await store.load(8, secondLoader)
    releaseFirst?.()
    await first

    expect(secondLoader).toHaveBeenCalledOnce()
    expect(store.loadedUserId).toBe(8)
  })
})
