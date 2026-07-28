import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const publicApi = vi.hoisted(() => ({
  status: vi.fn(),
  notice: vi.fn(),
  pricing: vi.fn(),
  uptime: vi.fn(),
}))

vi.mock('@/api/public', () => ({ publicApi }))

import { useAuthStore } from '@/stores/auth'
import { parseHeaderModules, useAppStore } from '@/stores/app'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  publicApi.status.mockResolvedValue({ system_name: 'Ren2Hub' })
  publicApi.notice.mockResolvedValue('Notice')
  publicApi.pricing.mockResolvedValue([{ id: 1 }])
  publicApi.uptime.mockResolvedValue([
    { monitors: [{ uptime: 0.999, status: 1 }] },
  ])
})

describe('public application state', () => {
  it('uses the landing reference brand before status is available', () => {
    expect(useAppStore().systemName).toBe('RenRen AI')
  })

  it('normalizes HeaderNavModules objects and JSON strings', () => {
    expect(parseHeaderModules('{"pricing":{"enabled":false}}')).toEqual({
      pricing: { enabled: false },
    })
    expect(parseHeaderModules('{bad json')).toEqual({})
  })

  it('distinguishes reachable status from degraded summaries', async () => {
    publicApi.notice.mockRejectedValueOnce(new Error('notice unavailable'))
    const store = useAppStore()

    await store.initialize()

    expect(store.statusReachable).toBe(true)
    expect(store.phase).toBe('degraded')
    expect(store.online).toBe(false)
  })

  it('allows a failed first initialization to retry', async () => {
    publicApi.status.mockRejectedValueOnce(new Error('offline'))
    const store = useAppStore()

    await store.initialize()
    expect(store.phase).toBe('error')

    await store.retry()
    expect(store.phase).toBe('ready')
    expect(store.online).toBe(true)
  })

  it('shares one in-flight initialization across callers', async () => {
    let resolveStatus!: (value: { system_name: string }) => void
    publicApi.status.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve
        })
    )
    const store = useAppStore()

    const first = store.initialize()
    const second = store.initialize()
    expect(publicApi.status).toHaveBeenCalledTimes(1)

    resolveStatus({ system_name: 'Ren2Hub' })
    await Promise.all([first, second])
    expect(store.phase).toBe('ready')
  })

  it('enforces registration and authenticated-pricing flags', async () => {
    publicApi.status.mockResolvedValueOnce({
      register_enabled: false,
      HeaderNavModules: {
        pricing: { enabled: true, requireAuth: true },
      },
    })
    const store = useAppStore()

    await store.initialize()

    expect(store.registerEnabled).toBe(false)
    expect(store.showPricing).toBe(false)
    expect(publicApi.pricing).not.toHaveBeenCalled()
  })

  it('loads protected pricing for an authenticated demo session', async () => {
    useAuthStore().persist({
      id: 1,
      username: 'demo',
      display_name: 'Demo',
      email: 'demo@example.com',
      role: 1,
      quota: 100,
      used_quota: 0,
    })
    publicApi.status.mockResolvedValueOnce({
      HeaderNavModules: {
        pricing: { enabled: true, requireAuth: true },
      },
    })
    const store = useAppStore()

    await store.initialize()

    expect(store.showPricing).toBe(true)
    expect(publicApi.pricing).toHaveBeenCalledTimes(1)
  })

  it('loads protected pricing when authentication changes during initialization', async () => {
    let resolveNotice!: (value: string) => void
    publicApi.notice.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveNotice = resolve
        })
    )
    publicApi.status.mockResolvedValueOnce({
      HeaderNavModules: {
        pricing: { enabled: true, requireAuth: true },
      },
    })
    const store = useAppStore()
    const initialization = store.initialize()
    await vi.waitFor(() => expect(publicApi.status).toHaveBeenCalledTimes(1))

    useAuthStore().persist({
      id: 1,
      username: 'demo',
      display_name: 'Demo',
      email: 'demo@example.com',
      role: 1,
      quota: 100,
      used_quota: 0,
    })
    resolveNotice('Notice')
    await initialization
    await vi.waitFor(() => expect(publicApi.pricing).toHaveBeenCalledTimes(1))
  })

  it('clamps malformed uptime ratios to the documented range', async () => {
    publicApi.uptime.mockResolvedValueOnce([
      { monitors: [{ uptime: 4, status: 1 }] },
    ])
    const store = useAppStore()

    await store.initialize()

    expect(store.uptimeLabel).toBe('100.00%')
  })
})
