import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consoleApi = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/console', () => ({ api: consoleApi }))

import { useAuthStore } from '@/stores/auth'
import { useTicketQueueStore } from '@/stores/ticketQueue'

describe('ticket queue summary refresh', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.clearAllMocks()
    consoleApi.get.mockResolvedValue({ pending: 3, unassigned: 2, mine: 1 })
    vi.spyOn(useAuthStore(), 'hasPermission').mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes on start, every minute, and when the window regains focus', async () => {
    const store = useTicketQueueStore()
    store.start()
    await flushPromises()

    expect(consoleApi.get).toHaveBeenCalledTimes(1)
    expect(store.summary).toEqual({ pending: 3, unassigned: 2, mine: 1 })

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(consoleApi.get).toHaveBeenCalledTimes(2)

    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(consoleApi.get).toHaveBeenCalledTimes(3)

    store.stop()
  })

  it('does not query the summary without ticket read permission', async () => {
    vi.mocked(useAuthStore().hasPermission).mockReturnValue(false)
    const store = useTicketQueueStore()

    await store.refresh()

    expect(consoleApi.get).not.toHaveBeenCalled()
    expect(store.summary).toEqual({ pending: 0, unassigned: 0, mine: 0 })
  })
})
