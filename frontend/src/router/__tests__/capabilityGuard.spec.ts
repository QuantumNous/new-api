import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const publicApi = vi.hoisted(() => ({
  status: vi.fn(),
  notice: vi.fn(),
  pricing: vi.fn(),
  uptime: vi.fn(),
}))

vi.mock('@/api/public', () => ({ publicApi }))

import router from '@/router'
import { useAuthStore } from '@/stores/auth'

beforeEach(async () => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
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
    quota: 100,
    used_quota: 0,
  })
  auth.checked = true

  await router.push('/')
})

describe('capability route guard', () => {
  it('fails closed for protected routes when status is unreachable', async () => {
    publicApi.status.mockRejectedValue(new Error('status unavailable'))

    await router.push('/console/market')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('keeps live routes available when status is unreachable', async () => {
    publicApi.status.mockRejectedValue(new Error('status unavailable'))

    await router.push('/console/models')

    expect(router.currentRoute.value.name).toBe('models')
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
