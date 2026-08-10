import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const setupApi = vi.hoisted(() => ({
  status: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('@/api/setup', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/setup')>('@/api/setup')
  return { ...actual, setupApi }
})

import { useSetupStore } from './setup'

const status = {
  status: false,
  root_init: false,
  database_type: 'sqlite',
}

describe('setup store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setupApi.status.mockResolvedValue(status)
  })

  it('deduplicates concurrent status requests', async () => {
    let resolve: (value: typeof status) => void = () => undefined
    setupApi.status.mockReturnValue(
      new Promise<typeof status>((done) => {
        resolve = done
      })
    )
    const store = useSetupStore()
    const first = store.load()
    const second = store.load()
    expect(setupApi.status).toHaveBeenCalledTimes(1)
    resolve(status)
    await expect(Promise.all([first, second])).resolves.toEqual([
      status,
      status,
    ])
  })

  it('forces a fresh status request', async () => {
    const store = useSetupStore()
    await store.load()
    await store.load(true)
    expect(setupApi.status).toHaveBeenCalledTimes(2)
  })

  it('clears credentials after successful initialization confirmation', async () => {
    const store = useSetupStore()
    await store.load()
    store.values.username = 'admin'
    store.values.password = 'password123'
    store.values.confirmPassword = 'password123'
    setupApi.submit.mockResolvedValue(undefined)
    setupApi.status.mockResolvedValueOnce({
      status: true,
      root_init: false,
      database_type: 'sqlite',
    })

    await store.submit()

    expect(store.values.username).toBe('')
    expect(store.values.password).toBe('')
    expect(store.values.confirmPassword).toBe('')
    expect(store.submitPhase).toBe('success')
  })

  it('keeps credentials when the POST business request fails', async () => {
    const store = useSetupStore()
    await store.load()
    store.values.username = 'admin'
    store.values.password = 'password123'
    store.values.confirmPassword = 'password123'
    setupApi.submit.mockRejectedValue(new Error('backend rejected setup'))

    await expect(store.submit()).rejects.toThrow('backend rejected setup')
    expect(store.values.username).toBe('admin')
    expect(store.values.password).toBe('password123')
    expect(store.values.confirmPassword).toBe('password123')
    expect(store.submitPhase).toBe('error')
  })

  it('clears passwords when POST succeeds even if confirmation fails', async () => {
    const store = useSetupStore()
    await store.load()
    store.values.username = 'admin'
    store.values.password = 'password123'
    store.values.confirmPassword = 'password123'
    setupApi.submit.mockResolvedValue(undefined)
    setupApi.status.mockRejectedValueOnce(new Error('confirmation unavailable'))

    await expect(store.submit()).rejects.toThrow('confirmation unavailable')
    expect(store.values.username).toBe('admin')
    expect(store.values.password).toBe('')
    expect(store.values.confirmPassword).toBe('')
    expect(store.phase).toBe('error')
  })

  it('rejects duplicate submissions while the first request is pending', async () => {
    let resolveSubmit: () => void = () => undefined
    setupApi.submit.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
    )
    setupApi.status.mockResolvedValueOnce(status).mockResolvedValueOnce({
      status: true,
      root_init: false,
      database_type: 'sqlite',
    })
    const store = useSetupStore()
    await store.load()
    const first = store.submit()

    await expect(store.submit()).rejects.toMatchObject({
      code: 'SETUP_SUBMIT_IN_PROGRESS',
    })
    resolveSubmit()
    await expect(first).resolves.toMatchObject({ status: true })
    expect(setupApi.submit).toHaveBeenCalledTimes(1)
  })
})
