import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { api } from '@/api/console'
import { writeDemoUser } from '@/api/demoStorage'
import { adminOrders, adminUsers, mockUser } from '@/api/mock/data'
import { resetMockState, setMockDelay } from '@/api/mock/state'
import { ApiError } from '@/api/types'
import type {
  AdminOrder,
  AdminOrderPage,
  AdminOrderStats,
  AdminOrderStatus,
} from '@/types/console'

function seedWithStatus(status: AdminOrderStatus): AdminOrder {
  const hit = adminOrders.find((order) => order.status === status)
  if (!hit) throw new Error(`expected an order seed with status ${status}`)
  return hit
}

beforeEach(() => {
  resetMockState()
  setMockDelay(0)
  writeDemoUser(mockUser)
})

afterEach(() => resetMockState())

describe('administrator order mock API', () => {
  it('lists the newest-first page in the production response shape', async () => {
    const page = await api.get<AdminOrderPage>('/api/order/')

    expect(page).toMatchObject({
      total: adminOrders.length,
      page: 1,
      page_size: 20,
    })
    expect(page.items).toHaveLength(20)
    expect(page.items[0]!.created).toBeGreaterThanOrEqual(
      page.items[1]!.created
    )
    expect(page.status_counts.completed).toBeGreaterThan(0)
    expect(page.method_counts.alipay).toBeGreaterThan(0)
    expect(page.type_counts.topup).toBeGreaterThan(0)
  })

  it('requires authentication', async () => {
    resetMockState()
    await expect(api.get<AdminOrderPage>('/api/order/')).rejects.toBeInstanceOf(
      ApiError
    )
  })

  it('searches by order number, email, username and ID', async () => {
    const target = adminOrders[3]!

    for (const keyword of [
      target.order_no,
      target.email.toUpperCase(),
      target.username,
      String(target.id),
    ]) {
      const page = await api.get<AdminOrderPage>('/api/order/search', {
        keyword,
        page_size: 100,
      })
      expect(page.items.map((order) => order.id)).toContain(target.id)
    }
  })

  it('filters independently on status, method and type', async () => {
    const byStatus = await api.get<AdminOrderPage>('/api/order/', {
      status: 'completed',
      page_size: 100,
    })
    expect(byStatus.items.every((o) => o.status === 'completed')).toBe(true)

    const byMethod = await api.get<AdminOrderPage>('/api/order/', {
      method: 'wechat',
      page_size: 100,
    })
    expect(byMethod.items.every((o) => o.method === 'wechat')).toBe(true)

    const byType = await api.get<AdminOrderPage>('/api/order/', {
      type: 'subscription',
      page_size: 100,
    })
    expect(byType.items.every((o) => o.type === 'subscription')).toBe(true)
  })

  it('keeps facet counts on the keyword-only set so facets do not move each other', async () => {
    const unfiltered = await api.get<AdminOrderPage>('/api/order/')
    const filtered = await api.get<AdminOrderPage>('/api/order/', {
      status: 'completed',
    })

    expect(filtered.status_counts).toEqual(unfiltered.status_counts)
    expect(filtered.method_counts).toEqual(unfiltered.method_counts)
    expect(filtered.total).toBeLessThan(unfiltered.total)
  })

  it('degrades an unknown filter value to unfiltered rather than an empty page', async () => {
    const page = await api.get<AdminOrderPage>('/api/order/', {
      status: 'not-a-status',
      method: 'bitcoin',
      type: 'nope',
    })
    expect(page.total).toBe(adminOrders.length)
  })

  it('reports paid revenue for the whole filtered set, not the page', async () => {
    const page = await api.get<AdminOrderPage>('/api/order/', {
      status: 'completed',
      page_size: 5,
    })
    const pageSum = page.items.reduce((sum, order) => sum + order.amount, 0)

    expect(page.items).toHaveLength(5)
    expect(page.filtered_revenue).toBeGreaterThan(pageSum)
  })

  it('excludes unpaid states from filtered revenue', async () => {
    const page = await api.get<AdminOrderPage>('/api/order/', {
      status: 'cancelled',
      page_size: 100,
    })
    expect(page.total).toBeGreaterThan(0)
    expect(page.filtered_revenue).toBe(0)
  })

  it('paginates and sorts on the requested column', async () => {
    const first = await api.get<AdminOrderPage>('/api/order/', {
      p: 1,
      page_size: 10,
      sort_by: 'amount',
      sort_order: 'asc',
    })
    const second = await api.get<AdminOrderPage>('/api/order/', {
      p: 2,
      page_size: 10,
      sort_by: 'amount',
      sort_order: 'asc',
    })

    expect(first.items).toHaveLength(10)
    expect(first.items[0]!.amount).toBeLessThanOrEqual(first.items[9]!.amount)
    expect(first.items[9]!.amount).toBeLessThanOrEqual(second.items[0]!.amount)
    expect(
      first.items.some((order) =>
        second.items.some((other) => other.id === order.id)
      )
    ).toBe(false)
  })

  it('caps the page size so a hostile query cannot dump the ledger', async () => {
    const page = await api.get<AdminOrderPage>('/api/order/', {
      page_size: 10_000,
    })
    expect(page.page_size).toBe(100)
    expect(page.items.length).toBeLessThanOrEqual(100)
  })
})

describe('order statistics', () => {
  it('honours each preset window and falls back to 30 days', async () => {
    for (const range of [7, 30, 90]) {
      const stats = await api.get<AdminOrderStats>('/api/order/stats', {
        range,
      })
      expect(stats.range).toBe(range)
      expect(stats.daily).toHaveLength(range)
    }

    const fallback = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 999,
    })
    expect(fallback.range).toBe(30)
  })

  it('returns the daily series in ascending date order', async () => {
    const stats = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 30,
    })
    const dates = stats.daily.map((point) => point.date)
    expect([...dates].sort()).toEqual(dates)
  })

  it('counts settled money only, and never nets refunds into revenue', async () => {
    const stats = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 90,
    })

    const seriesTotal = stats.daily.reduce(
      (sum, point) => sum + point.revenue,
      0
    )
    expect(seriesTotal).toBeCloseTo(stats.total_revenue, 1)
    expect(stats.refunded_total).toBeGreaterThan(0)
    expect(stats.total_revenue).toBeGreaterThan(0)

    const shareTotal = stats.payment_share.reduce(
      (sum, item) => sum + item.amount,
      0
    )
    expect(shareTotal).toBeCloseTo(stats.total_revenue, 1)
  })

  it('derives the average from the settled count', async () => {
    const stats = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 30,
    })
    expect(stats.average_amount).toBeCloseTo(
      stats.total_revenue / stats.total_orders,
      1
    )
  })

  it('ranks spenders descending and caps the podium at five', async () => {
    const stats = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 90,
    })
    const amounts = stats.top_spenders.map((item) => item.amount)

    expect(stats.top_spenders.length).toBeGreaterThan(0)
    expect(stats.top_spenders.length).toBeLessThanOrEqual(5)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
  })

  it('orders the payment split by revenue descending', async () => {
    const stats = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 90,
    })
    const amounts = stats.payment_share.map((item) => item.amount)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
  })
})

describe('order refund', () => {
  it('moves a completed order to refunded and stamps the time', async () => {
    const target = seedWithStatus('completed')

    const refunded = await api.post<AdminOrder>(
      `/api/order/${target.id}/refund`
    )

    expect(refunded.status).toBe('refunded')
    expect(refunded.refunded_at).toBeGreaterThan(0)
    expect(refunded.id).toBe(target.id)
  })

  it('reclaims the credited quota from the payer', async () => {
    const target = seedWithStatus('completed')
    const payer = adminUsers.find((user) => user.id === target.user_id)
    if (!payer) throw new Error('expected the payer to be on file')
    const before = payer.quota

    await api.post<AdminOrder>(`/api/order/${target.id}/refund`)

    expect(payer.quota).toBe(Math.max(0, before - target.quota))
  })

  it('refuses every non-completed state', async () => {
    for (const status of [
      'pending',
      'cancelled',
      'expired',
      'refunded',
    ] as AdminOrderStatus[]) {
      const target = adminOrders.find((order) => order.status === status)
      if (!target) continue
      await expect(
        api.post<AdminOrder>(`/api/order/${target.id}/refund`)
      ).rejects.toBeInstanceOf(ApiError)
      expect(target.status).toBe(status)
    }
  })

  it('refuses a second refund on the same order', async () => {
    const target = seedWithStatus('completed')
    await api.post<AdminOrder>(`/api/order/${target.id}/refund`)

    await expect(
      api.post<AdminOrder>(`/api/order/${target.id}/refund`)
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('rejects an unknown order id', async () => {
    await expect(
      api.post<AdminOrder>('/api/order/99999999/refund')
    ).rejects.toBeInstanceOf(ApiError)
  })

  it('removes the refunded order from revenue on the next read', async () => {
    const before = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 90,
    })
    const target = seedWithStatus('completed')

    await api.post<AdminOrder>(`/api/order/${target.id}/refund`)
    const after = await api.get<AdminOrderStats>('/api/order/stats', {
      range: 90,
    })

    expect(after.total_revenue).toBeCloseTo(
      before.total_revenue - target.amount,
      1
    )
    expect(after.total_orders).toBe(before.total_orders - 1)
    expect(after.refunded_orders).toBe(before.refunded_orders + 1)
  })
})

describe('order seed integrity', () => {
  it('credits quota consistently with the USD amount', () => {
    adminOrders.forEach((order) => {
      expect(order.quota).toBe(Math.round(order.amount * 500_000))
    })
  })

  it('stamps paid_at exactly on the settled states', () => {
    adminOrders.forEach((order) => {
      const settled =
        order.status === 'completed' || order.status === 'refunded'
      expect(order.paid_at > 0).toBe(settled)
    })
  })

  it('stamps refunded_at only on refunded orders', () => {
    adminOrders.forEach((order) => {
      expect(order.refunded_at > 0).toBe(order.status === 'refunded')
    })
  })

  it('issues unique ids and order numbers', () => {
    expect(new Set(adminOrders.map((o) => o.id)).size).toBe(adminOrders.length)
    expect(new Set(adminOrders.map((o) => o.order_no)).size).toBe(
      adminOrders.length
    )
  })

  it('never seeds a guest as a payer', () => {
    const guestIds = new Set(
      adminUsers.filter((user) => user.role === 0).map((user) => user.id)
    )
    expect(adminOrders.some((order) => guestIds.has(order.user_id))).toBe(false)
  })
})
