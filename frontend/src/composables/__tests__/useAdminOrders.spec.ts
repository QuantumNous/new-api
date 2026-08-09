import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api/console'
import { useAdminOrders } from '@/composables/useAdminOrders'
import i18n from '@/i18n'
import type { AdminOrderPage, AdminOrderStats } from '@/types/console'

const page: AdminOrderPage = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
  status_counts: { completed: 0, pending: 0, failed: 0 },
  method_counts: { epay: 0 },
  type_counts: { topup: 0 },
  filtered_epay_revenue: 0,
}

const stats: AdminOrderStats = {
  range: 30,
  generated_at: 1_700_000_000,
  currency: 'CNY',
  today_revenue: 0,
  today_orders: 0,
  total_revenue: 0,
  total_orders: 0,
  average_amount: 0,
  daily: [],
  payment_share: [],
  top_spenders: [],
}

let state: ReturnType<typeof useAdminOrders> | null = null

const Host = defineComponent({
  setup() {
    state = useAdminOrders()
    return () => null
  },
})

afterEach(() => {
  state = null
  vi.restoreAllMocks()
})

describe('useAdminOrders live endpoints', () => {
  it('loads list and Epay statistics from the next facade', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation((path) => {
      if (path === '/api/next/admin/orders')
        return Promise.resolve(page as never)
      if (path === '/api/next/admin/orders/stats') {
        return Promise.resolve(stats as never)
      }
      return Promise.reject(new Error(`unexpected endpoint: ${path}`))
    })

    const wrapper = mount(Host, {
      global: { plugins: [createPinia(), i18n] },
    })
    await flushPromises()

    expect(get).toHaveBeenCalledWith(
      '/api/next/admin/orders',
      expect.objectContaining({ p: 1, page_size: 20 }),
      expect.anything()
    )
    expect(get).toHaveBeenCalledWith(
      '/api/next/admin/orders/stats',
      { range: 30 },
      expect.anything()
    )
    expect(
      get.mock.calls.some(([path]) => String(path).startsWith('/api/order'))
    ).toBe(false)

    wrapper.unmount()
  })

  it('uses the same real list endpoint for exports', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation((path) => {
      if (path === '/api/next/admin/orders')
        return Promise.resolve(page as never)
      return Promise.resolve(stats as never)
    })
    const wrapper = mount(Host, {
      global: { plugins: [createPinia(), i18n] },
    })
    await flushPromises()
    if (!state) throw new Error('expected orders composable instance')

    await state.fetchAllForExport(new AbortController().signal)

    expect(get).toHaveBeenLastCalledWith(
      '/api/next/admin/orders',
      expect.objectContaining({ p: 1, page_size: 100 }),
      expect.anything()
    )
    wrapper.unmount()
  })
})
