import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createInstance } from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { SiteOrders } from '..'
import type { SiteOrder } from '../api'
import { OrderDetail } from '../order-detail'
import { OrderStatus } from '../order-status'
import { paymentProviderStatusLabel } from '../presentation'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
const order: SiteOrder = {
  id: 1,
  user_id: 2,
  username: 'buyer',
  trade_no: 'ALI-long-order-number-123456789',
  provider_trade_no: 'transaction-1',
  payment_provider: 'alipay',
  payment_method: 'alipay_direct',
  order_status: 'paid',
  amount_fen: 12345,
  frozen_quota: 1000000,
  money: 123.45,
  create_time: 1700000000,
  complete_time: 0,
  expires_at: 1700001800,
  sandbox: true,
  cache_pending: false,
  last_error: 'credit_pending',
  last_check_at: 0,
  last_check_success: null,
}
let client: QueryClient
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
})
afterEach(() => {
  client.clear()
  vi.resetAllMocks()
  useAuthStore.getState().auth.setUser(null)
})
function showOrder() {
  return render(
    <QueryClientProvider client={client}>
      <OrderDetail id={1} onClose={() => {}} />
    </QueryClientProvider>
  )
}
describe('Site order detail', () => {
  test('root can record a review outcome without clearing the payment hold', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: { ...order, review_required: true, review_version: 'version-1' },
      },
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
    showOrder()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Resolve payment review' })
    )
    const dialog = await screen.findByRole('alertdialog')
    expect(
      within(dialog).getByText(
        'Record the investigation or external refund outcome. This does not change balances, subscriptions or the payment hold.'
      )
    ).toBeVisible()
    await userEvent.type(
      within(dialog).getByLabelText('Review outcome'),
      'Refund handled externally'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Record review outcome' })
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/user/orders/1/review', {
        note: 'Refund handled externally',
      })
    )
    expect(await screen.findByText('Review outcome recorded.')).toBeVisible()
  })

  test('refund resolution requires a reference and sends the displayed version', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: { ...order, review_required: true, review_version: 'version-1' },
      },
    })
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
    showOrder()
    await userEvent.click(
      await screen.findByRole('button', { name: 'Resolve payment review' })
    )
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: 'Resolution' })
    )
    await userEvent.click(
      await screen.findByRole('option', { name: 'Record external refund' })
    )
    await userEvent.type(
      within(dialog).getByLabelText('Review outcome'),
      'Refund confirmed externally'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Resolve payment review' })
    )
    expect(
      await screen.findByText('Refund reference is required.')
    ).toBeVisible()
    expect(api.post).not.toHaveBeenCalled()
    await userEvent.type(
      within(dialog).getByLabelText('Refund reference'),
      'REF-123'
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Resolve payment review' })
    )
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/user/orders/1/review', {
        note: 'Refund confirmed externally',
        action: 'refunded',
        reference: 'REF-123',
        version: 'version-1',
      })
    )
  })

  test('resolved review keeps payment hold but hides resolution action', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          ...order,
          review_required: true,
          review_resolution: 'refunded',
        },
      },
    })
    showOrder()
    expect(await screen.findByText('External refund recorded')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Resolve payment review' })
    ).not.toBeInTheDocument()
  })

  test('held subscription payment is shown as paid awaiting review, not completed', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          ...order,
          order_type: 'subscription',
          order_status: 'paid_review',
          review_required: true,
          last_error: 'subscription_conflict',
        },
      },
    })
    showOrder()
    expect(
      await screen.findByText('Paid, awaiting manual review')
    ).toBeVisible()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Verify and recover order' })
    ).not.toBeInTheDocument()
  })

  test.each([
    ['alipay', 'Alipay transaction number', 'transaction-1'],
    ['wechatpay', 'WeChat Pay transaction ID', 'wechat-transaction-1'],
    ['wechatpay', 'WeChat Pay transaction ID', ''],
  ])(
    '%s order labels site and provider numbers separately (%s, %s)',
    async (provider, label, transaction) => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: {
            ...order,
            payment_provider: provider,
            provider_trade_no: transaction,
          },
        },
      })
      showOrder()
      expect(await screen.findByText('Site order number')).toBeVisible()
      expect(screen.getByText(order.trade_no)).toBeVisible()
      expect(screen.getByText(label)).toBeVisible()
      expect(screen.getByText(transaction || 'Not yet available')).toBeVisible()
    }
  )

  test('paid order shows frozen CNY amount and credit warning without claiming completion', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: order },
    })
    showOrder()
    expect(await screen.findByText('Paid, awaiting credit')).toBeVisible()
    expect(screen.getAllByText('CNY 123.45')).toHaveLength(2)
    expect(screen.getByText('Payment requires attention')).toBeVisible()
    expect(screen.getByText('Sandbox')).toBeVisible()
    expect(screen.getByText('Frozen quota')).toBeVisible()
    expect(screen.getByText('Equivalent at current display rate')).toBeVisible()
    expect(screen.queryByText('Completed')).not.toBeInTheDocument()
  })
  test('ordinary administrator can read but cannot trigger payment verification', async () => {
    useAuthStore.getState().auth.setUser({ id: 3, username: 'admin', role: 10 })
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: order },
    })
    showOrder()
    await screen.findByText(order.trade_no)
    expect(
      screen.queryByRole('button', { name: 'Check payment result' })
    ).not.toBeInTheDocument()
  })
  test('in-flight verification disables repeated clicks and failure preserves unpaid-credit state', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: order },
    })
    let rejectRequest: (reason: Error) => void = () => {}
    vi.mocked(api.post).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject
        })
    )
    showOrder()
    const button = await screen.findByRole('button', {
      name: 'Check payment result',
    })
    await userEvent.click(button)
    expect(button).toBeDisabled()
    rejectRequest(new Error('network unavailable'))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Payment check failed'
    )
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByText('Paid, awaiting credit')).toBeVisible()
  })
  test('failed detail request offers a working retry', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValue({ data: { success: true, data: order } })
    showOrder()
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(order.trade_no)).toBeVisible()
  })
})

test('recovery requires a reason and reports already credited without claiming a new credit', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: order } })
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { result: 'already_credited' } },
  })
  showOrder()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Verify and recover order' })
  )
  const confirm = within(screen.getByRole('alertdialog')).getByRole('button', {
    name: 'Verify and recover order',
  })
  await userEvent.click(confirm)
  expect(
    await screen.findByText('Enter a reason between 5 and 500 characters.')
  ).toBeVisible()
  expect(api.post).not.toHaveBeenCalled()
  await userEvent.type(
    screen.getByLabelText('Recovery reason'),
    'Missing payment notification'
  )
  await userEvent.click(confirm)
  expect(
    await screen.findByText(
      'This order was already credited. No duplicate credit was added.'
    )
  ).toBeVisible()
  expect(api.post).toHaveBeenCalledWith('/api/user/orders/1/recover', {
    reason: 'Missing payment notification',
  })
})

describe('Site order table', () => {
  test('actions header and detail button stay pinned at the right edge', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: { items: [order], total: 1 } },
    })
    const router = createRouter({
      routeTree: createRootRoute({ component: SiteOrders }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    const details = await screen.findByRole('button', { name: 'Details' })
    for (const id of [
      'order-keyword',
      'order-user',
      'order-start',
      'order-end',
      'order-provider',
      'order-status',
    ]) {
      const field = document.querySelector(`label[for="${id}"]`)?.parentElement
      expect(field).toHaveClass('flex', 'flex-col', 'gap-1')
      expect(field).not.toHaveClass('space-y-1')
    }

    expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass(
      'sticky',
      'right-0'
    )
    expect(details.closest('td')).toHaveClass(
      'sticky',
      'right-0',
      'bg-background'
    )
  })
})

test('personal detail uses self API and hides admin actions even for a root account', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: order } })
  render(
    <QueryClientProvider client={client}>
      <OrderDetail id={1} scope='personal' onClose={() => {}} />
    </QueryClientProvider>
  )
  expect(await screen.findByText(order.trade_no)).toBeVisible()
  expect(api.get).toHaveBeenCalledWith('/api/user/self/orders/1')
  expect(
    screen.queryByRole('button', { name: 'Check payment result' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Verify and recover order' })
  ).not.toBeInTheDocument()
  expect(screen.queryByText('Last manual check')).not.toBeInTheDocument()
  expect(screen.queryByText('Check result')).not.toBeInTheDocument()
  expect(screen.queryByText('Frozen quota')).not.toBeInTheDocument()
  expect(
    screen.queryByText('Equivalent at current display rate')
  ).not.toBeInTheDocument()
  expect(
    screen.queryByText(
      'Frozen quota is authoritative. Historical exchange rates are not recorded.'
    )
  ).not.toBeInTheDocument()
})

test('subscription receipt displays its actual currency and amount without top-up recovery actions', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'root', role: 100 })
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        id: -5,
        order_type: 'subscription',
        payment_provider: 'stripe',
        payment_method: 'stripe',
        amount_fen: null,
        order_status: 'success',
        currency: 'EUR',
        payment_amount: '8.25',
        provider_trade_no: 'pi_verified',
        money: 99,
      },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <OrderDetail id={-5} onClose={() => {}} />
    </QueryClientProvider>
  )
  expect(await screen.findByText('Subscription')).toBeVisible()
  expect(screen.getAllByText('EUR 8.25')).toHaveLength(2)
  expect(screen.getByText('pi_verified')).toBeVisible()
  expect(api.get).toHaveBeenCalledWith('/api/user/orders/-5')
  expect(
    screen.queryByRole('button', { name: 'Verify and recover order' })
  ).not.toBeInTheDocument()
})

test('failed order displays a translated failure status', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: { ...order, order_status: 'failed', last_check_success: null },
    },
  })
  showOrder()
  expect(await screen.findByText('Failed')).toBeVisible()
})

test('MixPay admin detail offers server verification and review notes while holding recovery without claiming a pending payment was received', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        payment_provider: 'mixpay',
        payment_method: 'mixpay',
        order_status: 'pending',
        review_required: true,
        amount_fen: null,
        currency: 'USD',
        payment_amount: '1.43',
        gateway_status: 'unpaid',
      },
    },
  })
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { result: 'unpaid' } },
  })
  showOrder()
  const check = await screen.findByRole('button', {
    name: 'Check payment result',
  })
  expect(screen.getAllByText('USD 1.43')).toHaveLength(1)
  expect(screen.getByText('Awaiting payment', { selector: 'dd' })).toBeVisible()
  await userEvent.click(check)
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/orders/1/recheck')
  )
  expect(
    screen.queryByRole('button', { name: 'Verify and recover order' })
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Resolve payment review' })
  ).toBeVisible()
})

test('WebMoney admin detail enables X18 verification and recovery', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        order_type: 'topup',
        payment_provider: 'webmoney',
        payment_method: 'webmoney',
        order_status: 'pending',
        amount_fen: null,
        currency: 'WMT',
        payment_amount: '10.00',
        gateway_status: 'x18:8',
      },
    },
  })
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } })
  showOrder()
  const check = await screen.findByRole('button', {
    name: 'Check payment result',
  })
  expect(
    screen.getByRole('button', { name: 'Verify and recover order' })
  ).toBeEnabled()
  expect(screen.getByText('Payment not found')).toBeVisible()
  await userEvent.click(check)
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/orders/1/recheck')
  )
})

test('personal Antom orders offer server recheck and confirmed cancellation even after checkout expiry', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        payment_provider: 'antom',
        payment_method: 'antom',
        order_status: 'pending',
        gateway_status: 'PROCESSING',
      },
    },
  })
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { status: 'closed' } },
  })
  render(
    <QueryClientProvider client={client}>
      <OrderDetail id={1} scope='personal' onClose={() => {}} />
    </QueryClientProvider>
  )
  await userEvent.click(
    await screen.findByRole('button', { name: 'Check payment result' })
  )
  expect(api.post).toHaveBeenCalledWith('/api/user/self/orders/1/recheck', {})
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Cancel order' })
  )
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/self/orders/1/cancel', {})
  )
})

test('WebMoney local expiry is not presented as provider-confirmed closure', () => {
  render(
    <OrderStatus
      order={{
        ...order,
        payment_provider: 'webmoney',
        order_status: 'expired',
        close_reason: 'local_expiry',
        last_error: '',
      }}
    />
  )
  expect(screen.getByText('Expired')).toBeVisible()
  expect(screen.queryByText('Closed')).not.toBeInTheDocument()
})

test('rejected Antom cancellation is not shown as still closing', () => {
  render(
    <OrderStatus
      order={{
        ...order,
        payment_provider: 'antom',
        order_status: 'pending',
        cancel_requested: true,
        cancellation_state: 'rejected',
      }}
    />
  )
  expect(screen.getByText('Cancellation rejected')).toBeVisible()
  expect(screen.queryByText('Closing order')).not.toBeInTheDocument()
})

test('completed Antom payment remains completed after an earlier rejected cancellation', () => {
  render(
    <OrderStatus
      order={{
        ...order,
        payment_provider: 'antom',
        order_status: 'success',
        cancel_requested: true,
        cancellation_state: 'rejected',
      }}
    />
  )
  expect(screen.getByText('Completed')).toBeVisible()
  expect(screen.queryByText('Cancellation rejected')).not.toBeInTheDocument()
})

test('locally expired Antom order is not presented as provider-confirmed closure', () => {
  render(
    <OrderStatus
      order={{
        ...order,
        payment_provider: 'antom',
        order_status: 'expired',
        close_reason: 'local_expiry',
      }}
    />
  )
  expect(screen.getByText('Expired')).toBeVisible()
  expect(screen.queryByText('Closed')).not.toBeInTheDocument()
})

test('locally expired Antom order still offers provider cancellation in details', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        payment_provider: 'antom',
        order_status: 'expired',
        close_reason: 'local_expiry',
        cancel_requested: false,
      },
    },
  })
  showOrder()
  expect(
    await screen.findByRole('button', { name: 'Cancel order' })
  ).toBeVisible()
})

test('provider states have distinct Chinese meanings and unknown codes remain visible', async () => {
  const translations = createInstance()
  await translations.init({ lng: 'zh', resources: { zh } })
  const cases = [
    ['antom', 'SUCCESS', '支付成功'],
    ['antom', 'CAPTURE_PENDING', '扣款尚未完成'],
    ['antom', 'API_FUTURE_CODE', '支付查询接口异常（FUTURE_CODE）'],
    ['webmoney', 'x18:8', '未找到成功付款'],
    ['webmoney', 'x18:-6', '查询签名或摘要验证失败'],
    ['webmoney', 'query_failed', '支付查询或校验失败'],
    ['webmoney', 'x18:999', '未识别的渠道状态（x18:999）'],
    ['mixpay', 'failed', '支付失败'],
    ['mixpay', 'paid_less', '付款不足，等待补款'],
    ['alipay', 'TRADE_CLOSED', '未付款交易已关闭，或已全额退款'],
    ['wechatpay', 'REFUND', '转入退款，退款结果待核实'],
    ['wechatpay', 'NOTPAY', '待支付'],
    ['wechatpay', 'failed', '未识别的渠道状态（failed）'],
    ['antom', '', '未记录'],
    ['unknown', 'SUCCESS', '未识别的渠道状态（SUCCESS）'],
  ]
  for (const [provider, status, expected] of cases) {
    expect(paymentProviderStatusLabel(provider, status, translations.t)).toBe(
      expected
    )
  }
})
