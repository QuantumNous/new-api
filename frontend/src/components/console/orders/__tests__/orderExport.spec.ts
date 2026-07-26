import { describe, expect, it } from 'vitest'

import {
  getOrderExportValues,
  ORDER_EXPORT_HEADERS,
} from '@/components/console/orders/orderExport'
import type { AdminOrder } from '@/types/console'

const order: AdminOrder = {
  id: 412,
  order_no: 'sub2_20260725RHcR5xPa',
  user_id: 2331,
  username: 'ada.lovelace',
  email: 'ada@example.com',
  amount: 20,
  quota: 10_000_000,
  type: 'subscription',
  method: 'alipay',
  status: 'completed',
  subject: '专业版 · 30 天',
  created: 1_752_000_000,
  paid_at: 1_752_000_240,
  refunded_at: 0,
}

describe('order exports', () => {
  it('keeps the header row aligned with the value row', () => {
    expect(getOrderExportValues(order)).toHaveLength(
      ORDER_EXPORT_HEADERS.length
    )
  })

  it('exports amounts as bare numbers so a spreadsheet can sum them', () => {
    const values = getOrderExportValues(order)
    const amount = values[ORDER_EXPORT_HEADERS.indexOf('amount_usd')]

    expect(amount).toBe(20)
    expect(typeof amount).toBe('number')
    // The unit lives in the header, not in the cell.
    expect(ORDER_EXPORT_HEADERS).toContain('amount_usd')
  })

  it('exports the full row in header order', () => {
    expect(getOrderExportValues(order)).toEqual([
      412,
      'sub2_20260725RHcR5xPa',
      'ada.lovelace',
      'ada@example.com',
      '专业版 · 30 天',
      'subscription',
      'alipay',
      'completed',
      20,
      10_000_000,
      expect.any(String),
      expect.any(String),
      '',
    ])
  })

  it('renders a never-happened stamp as blank rather than the epoch', () => {
    const values = getOrderExportValues(order)
    const refunded = values[ORDER_EXPORT_HEADERS.indexOf('refunded_at')]

    expect(refunded).toBe('')
    expect(String(refunded)).not.toContain('1970')
  })

  it('formats a stamp that did happen', () => {
    const paid =
      getOrderExportValues(order)[ORDER_EXPORT_HEADERS.indexOf('paid_at')]

    expect(paid).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  it('blanks both stamps on an order that never settled', () => {
    const values = getOrderExportValues({
      ...order,
      status: 'expired',
      paid_at: 0,
      refunded_at: 0,
    })

    expect(values[ORDER_EXPORT_HEADERS.indexOf('paid_at')]).toBe('')
    expect(values[ORDER_EXPORT_HEADERS.indexOf('refunded_at')]).toBe('')
    // The creation stamp always exists, so it must survive.
    expect(values[ORDER_EXPORT_HEADERS.indexOf('created')]).not.toBe('')
  })
})
