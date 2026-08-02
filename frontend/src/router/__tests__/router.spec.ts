import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { writeDemoUser } from '@/api/demoStorage'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import router, { sanitizeRedirect } from '@/router'

const demoUser = {
  id: 1,
  username: 'demo',
  display_name: 'Demo',
  email: 'demo@example.com',
  role: 1,
  quota: 100,
  used_quota: 0,
}

beforeEach(async () => {
  resetMockState()
  setMockDelay(0)
  setActivePinia(createPinia())
  await router.push('/')
})

describe('application router', () => {
  it('accepts only Console and Lab post-login redirects', () => {
    expect(sanitizeRedirect('/console/models?tab=all')).toBe(
      '/console/models?tab=all'
    )
    expect(sanitizeRedirect('/lab/chat/2')).toBe('/lab/chat/2')
    expect(sanitizeRedirect('//evil.example')).toBeNull()
    // URL parsing treats "\" as "/" in special schemes, so this is a
    // protocol-relative escape attempt — the origin check must catch it.
    expect(sanitizeRedirect('/\\evil.example')).toBeNull()
    expect(sanitizeRedirect('/auth/sign-in')).toBeNull()
  })

  it('redirects legacy pricing to sign-in with the final protected target', async () => {
    await router.push('/pricing')
    expect(router.currentRoute.value.name).toBe('sign-in')
    expect(router.currentRoute.value.query.redirect).toBe('/console/models')
  })

  it('allows a valid demo session into protected routes', async () => {
    writeDemoUser(demoUser)
    await router.push('/console/models')
    expect(router.currentRoute.value.name).toBe('models')
  })

  it('protects the administrator channel list with the permission gate', async () => {
    writeDemoUser(demoUser)
    await router.push('/console/channels')

    expect(router.currentRoute.value.name).toBe('channels')
    expect(router.currentRoute.value.meta).toMatchObject({
      wide: true,
      noPageScroll: true,
      requiresAdmin: true,
    })
  })

  it('opens the log ledger in the wide console layout', async () => {
    writeDemoUser(demoUser)
    await router.push('/console/logs')

    expect(router.currentRoute.value.meta).toMatchObject({
      wide: true,
      noPageScroll: true,
    })
  })

  it('opens the administrator order ledger as a wide admin route', async () => {
    writeDemoUser(demoUser)
    await router.push('/console/orders')

    expect(router.currentRoute.value.name).toBe('orders')
    expect(router.currentRoute.value.meta).toMatchObject({
      wide: true,
      noPageScroll: true,
      requiresAdmin: true,
    })
  })

  it('redirects authenticated guests away from auth pages', async () => {
    writeDemoUser(demoUser)
    await router.push('/auth/sign-in')
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('resolves compatibility and not-found routes', async () => {
    await router.push('/home')
    expect(router.currentRoute.value.name).toBe('home')
    await router.push('/missing-page')
    expect(router.currentRoute.value.name).toBe('not-found')
  })
})
