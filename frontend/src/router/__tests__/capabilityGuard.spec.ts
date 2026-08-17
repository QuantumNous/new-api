import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const publicApi = vi.hoisted(() => ({
  status: vi.fn(),
  notice: vi.fn(),
  pricing: vi.fn(),
  uptime: vi.fn(),
}))

const setupApi = vi.hoisted(() => ({
  status: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('@/api/public', () => ({ publicApi }))
vi.mock('@/api/setup', () => ({ setupApi }))

import router from '@/router'
import { sanitizeSetupRedirect } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useSetupStore } from '@/stores/setup'

beforeEach(async () => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setupApi.status.mockResolvedValue({
    status: true,
    root_init: true,
    database_type: 'postgres',
  })
  publicApi.notice.mockResolvedValue('')
  publicApi.pricing.mockResolvedValue([])
  publicApi.uptime.mockResolvedValue([])

  const auth = useAuthStore()
  auth.persist({
    id: 1,
    username: 'user',
    display_name: 'User',
    email: 'user@example.com',
    role: 1,
    status: 1,
    quota: 100,
    used_quota: 0,
    request_count: 0,
    created_at: 1_700_000_000,
  })
  auth.checked = true

  await router.push('/')
})

describe('capability route guard', () => {
  it('redirects uninitialized routes to setup before auth checks', async () => {
    const setup = useSetupStore()
    setup.phase = 'idle'
    setup.status = null
    setupApi.status.mockResolvedValue({
      status: false,
      root_init: false,
      database_type: 'sqlite',
    })

    await router.push('/console/models')

    expect(router.currentRoute.value.name).toBe('setup')
  })

  it('redirects setup status failures to the global setup error page', async () => {
    const setup = useSetupStore()
    setup.phase = 'idle'
    setup.status = null
    setupApi.status.mockRejectedValue(new Error('setup unavailable'))

    await router.push('/console/models')

    expect(router.currentRoute.value.name).toBe('setup-error')
    expect(router.currentRoute.value.query.redirect).toBe('/console/models')
  })

  it('redirects initialized setup visits to the Vue home page', async () => {
    await router.push('/setup')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('rejects unsafe setup redirect targets', () => {
    expect(sanitizeSetupRedirect('https://evil.example/')).toBeNull()
    expect(sanitizeSetupRedirect('//evil.example/')).toBeNull()
    expect(sanitizeSetupRedirect('/setup/error')).toBeNull()
    expect(sanitizeSetupRedirect('/auth/sign-in')).toBe('/auth/sign-in')
    expect(sanitizeSetupRedirect('/next/console/dashboard?tab=1')).toBe(
      '/console/dashboard?tab=1'
    )
  })

  it('fails closed for protected routes when status is unreachable', async () => {
    publicApi.status.mockRejectedValue(new Error('status unavailable'))

    await router.push('/console/market')

    expect(router.currentRoute.value.name).toBe('dashboard')
  }, 15000)

  it('keeps live routes available when status is unreachable', async () => {
    publicApi.status.mockRejectedValue(new Error('status unavailable'))

    await router.push('/console/models')

    expect(router.currentRoute.value.name).toBe('models')
  })

  it('redirects non-admin users away from operation logs', async () => {
    await router.push('/console/logs/operations')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('keeps system settings root-only even for ordinary administrators', async () => {
    const auth = useAuthStore()
    auth.persist({
      id: 2,
      username: 'admin',
      display_name: 'Admin',
      email: 'admin@example.com',
      role: 10,
      status: 1,
      quota: 100,
      used_quota: 0,
      request_count: 0,
      created_at: 1_700_000_000,
    })
    auth.checked = true

    await router.push('/console/system-settings/site')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('redirects every deferred module when its capability is disabled', async () => {
    publicApi.status.mockResolvedValue({
      frontend_capabilities: {
        marketplace: 'disabled',
        subscription_balance: 'disabled',
        invoices: 'disabled',
        farm: 'disabled',
        bigame: 'disabled',
        lab: 'disabled',
      },
    })

    for (const path of [
      '/console/market',
      '/console/subscription',
      '/console/plan-management',
      '/console/invoice',
      '/console/farm',
      '/console/bigame',
      '/lab/chat',
    ]) {
      await router.push(path)
      expect(router.currentRoute.value.name, path).toBe('dashboard')
    }
  })
})
