import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { SiteOrders } from '..'
import type { SiteOrder } from '../api'
import { OrderDetail } from '../order-detail'

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
    expect(screen.getByText('Credit requires attention')).toBeVisible()
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
