import { describe, expect, it } from 'vitest'

import {
  getOrderExportValues,
  ORDER_EXPORT_HEADERS,
} from '@/components/console/orders/orderExport'
import type { AdminOrder } from '@/types/console'

const order: AdminOrder = {
  id: 412,
  order_no: 'USR2331NOabc123',
  user_id: 2331,
  username: 'ada.lovelace',
  email: 'ada@example.com',
  amount: 142.5,
  quota: 10_000_000,
  currency: 'CNY',
  type: 'topup',
  method: 'epay',
  payment_method: 'alipay',
  status: 'completed',
  created: 1_752_000_000,
  paid_at: 1_752_000_240,
}

describe('order exports', () => {
  it('keeps the header row aligned with the value row', () => {
    expect(getOrderExportValues(order)).toHaveLength(
      ORDER_EXPORT_HEADERS.length
    )
  })

  it('exports amount and currency as separate spreadsheet fields', () => {
    const values = getOrderExportValues(order)

    expect(values[ORDER_EXPORT_HEADERS.indexOf('amount')]).toBe(142.5)
    expect(values[ORDER_EXPORT_HEADERS.indexOf('currency')]).toBe('CNY')
  })

  it('exports provider and Epay rail without conflating them', () => {
    const values = getOrderExportValues(order)

    expect(values[ORDER_EXPORT_HEADERS.indexOf('payment_provider')]).toBe(
      'epay'
    )
    expect(values[ORDER_EXPORT_HEADERS.indexOf('payment_method')]).toBe(
      'alipay'
    )
  })

  it('leaves a missing payment timestamp blank', () => {
    const values = getOrderExportValues({ ...order, paid_at: 0 })

    expect(values[ORDER_EXPORT_HEADERS.indexOf('paid_at')]).toBe('')
    expect(values[ORDER_EXPORT_HEADERS.indexOf('created')]).not.toBe('')
  })
})
