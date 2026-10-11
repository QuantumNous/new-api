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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { SiteOrders } from '../index'
import { PendingOrderNotice } from '../pending-order-notice'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => vi.resetAllMocks())
async function showPage(personal = false, notice = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () =>
        notice ? (
          <PendingOrderNotice />
        ) : (
          <SiteOrders scope={personal ? 'personal' : 'site'} />
        ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return client
}
test('empty orders remain searchable and search sends user and order filters to server', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage()
  expect(await screen.findByText('No billing records found')).toBeVisible()
  await userEvent.type(
    screen.getByLabelText('Order or payment transaction number'),
    'WX123'
  )
  await userEvent.type(screen.getByLabelText('Username or user ID'), '42')
  expect(
    screen.queryByRole('button', { name: /^Search$/ })
  ).not.toBeInTheDocument()
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({
        keyword: 'WX123',
        user: '42',
        p: 1,
        page_size: 20,
      }),
    })
  )
  client.clear()
})
test('list failure displays retry instead of a misleading empty list', async () => {
  vi.mocked(api.get)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({
      data: { success: true, data: { items: [], total: 0 } },
    })
  const client = await showPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('No billing records found')).toBeVisible()
  client.clear()
})

test('choosing a payment provider filters immediately and resets the page', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 60 } },
  })
  const client = await showPage()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Go to next page' })
  )
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({ p: 2 }),
    })
  )
  await userEvent.click(
    screen.getByRole('combobox', { name: 'Payment Method' })
  )
  await userEvent.click(await screen.findByRole('option', { name: 'Alipay' }))
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/orders', {
      params: expect.objectContaining({ provider: 'alipay', p: 1 }),
    })
  )
  client.clear()
})

test('personal orders use the scoped endpoint and hide user filtering', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage(true)
  expect(
    await screen.findByRole('heading', { name: 'My orders' })
  ).toBeVisible()
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith(
      '/api/user/self/orders',
      expect.anything()
    )
  )
  expect(screen.queryByLabelText('Username or user ID')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'User' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('columnheader', { name: 'Frozen quota' })
  ).not.toBeInTheDocument()
  client.clear()
})

test.each([false, true])(
  'order list shows payment branding in personal scope %s',
  async (personal) => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          total: 2,
          items: [
            {
              id: 1,
              trade_no: 'ALI-test',
              payment_method: 'alipay_direct',
              status: 'pending',
              sandbox: true,
              money: 1,
              amount_fen: 100,
            },
            {
              id: 2,
              trade_no: 'WX-test',
              payment_method: 'wechatpay_native',
              status: 'pending',
              sandbox: false,
              money: 1,
              amount_fen: 100,
            },
          ],
        },
      },
    })
    const client = await showPage(personal)
    const alipay = await screen.findByText('Alipay', {
      selector: 'td span span',
    })
    const wechat = screen.getByText('WeChat Pay', { selector: 'td span span' })
    expect(alipay.parentElement).toHaveClass(
      'text-blue-600',
      'dark:text-blue-400'
    )
    expect(wechat.parentElement).toHaveClass(
      'text-green-700',
      'dark:text-green-400'
    )
    expect(alipay.parentElement?.querySelector('svg')).toHaveStyle({
      color: '#1677FF',
    })
    expect(wechat.parentElement?.querySelector('svg')).toHaveStyle({
      color: '#07C160',
    })
    expect(screen.getByText('Sandbox')).toBeVisible()
    client.clear()
  }
)

test('personal pending direct orders offer payment and cancellation instead of details and reuse the order', async () => {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url).includes('/wechatpay/order/')) {
      return { data: { success: true, data: { status: 'pending' } } }
    }
    return {
      data: {
        success: true,
        data: {
          total: 3,
          items: [
            {
              id: 10,
              trade_no: 'WX-resume',
              payment_provider: 'wechatpay',
              payment_method: 'wechatpay_native',
              order_status: 'pending',
              expires_at: 4102444800,
              amount_fen: 123,
            },
            {
              id: 11,
              trade_no: 'ALI-expired',
              payment_provider: 'alipay',
              payment_method: 'alipay_direct',
              order_status: 'pending',
              expires_at: 1,
              amount_fen: 100,
            },
            {
              id: 12,
              trade_no: 'ALI-cancelling',
              payment_provider: 'alipay',
              payment_method: 'alipay_direct',
              order_status: 'pending',
              cancel_requested: true,
              expires_at: 4102444800,
              amount_fen: 100,
            },
          ],
        },
      },
    }
  })
  vi.mocked(api.post).mockResolvedValue({
    data: {
      success: true,
      data: {
        payment_provider: 'wechatpay',
        trade_no: 'WX-resume',
        amount: '1.23',
        currency: 'CNY',
        expires_at: 4102444800,
        code_url: 'weixin://wxpay/bizpayurl?pr=original',
      },
    },
  })
  const client = await showPage(true)
  const pay = await screen.findByRole('button', { name: 'Pay' })
  expect(screen.getAllByRole('button', { name: 'Pay' })).toHaveLength(1)
  expect(pay.nextElementSibling).toHaveTextContent('Cancel')
  expect(
    within(screen.getByRole('row', { name: /WX-resume/ })).queryByRole(
      'button',
      { name: 'Details' }
    )
  ).not.toBeInTheDocument()
  await userEvent.click(pay)
  expect(api.post).toHaveBeenCalledWith('/api/user/self/orders/10/pay', {
    mobile: false,
  })
  expect(
    await screen.findByRole('dialog', { name: 'WeChat Pay' })
  ).toBeVisible()
  expect(
    within(screen.getByRole('dialog', { name: 'WeChat Pay' })).getByText(
      'CNY 1.23'
    )
  ).toBeVisible()
  client.clear()
})

test('wallet pending notice disappears after cancellation is accepted', async () => {
  useAuthStore.getState().auth.setUser({ id: 42, username: 'test', role: 1 })
  let cancelled = false
  vi.mocked(api.get).mockImplementation(async (_url, config) => ({
    data: {
      success: true,
      data: {
        total: config?.params.provider === 'alipay' ? 1 : 0,
        items:
          config?.params.provider === 'alipay'
            ? [
                {
                  id: 15,
                  trade_no: 'ALI-notice',
                  payment_provider: 'alipay',
                  payment_method: 'alipay_direct',
                  order_status: 'pending',
                  expires_at: 4102444800,
                  amount_fen: 123,
                  cancel_requested: cancelled,
                },
              ]
            : [],
      },
    },
  }))
  vi.mocked(api.post).mockImplementation(async () => {
    cancelled = true
    return { data: { success: true, data: { status: 'closing' } } }
  })
  const client = await showPage(true, true)
  expect(await screen.findByText('You have an unpaid order')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('retained')
  expect(dialog).not.toHaveTextContent('permanently deleted')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Cancel order' })
  )
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/self/orders/15/cancel', {})
  )
  await waitFor(() =>
    expect(
      screen.queryByText('You have an unpaid order')
    ).not.toBeInTheDocument()
  )
  expect(screen.queryByRole('button', { name: 'Pay' })).not.toBeInTheDocument()
  client.clear()
  useAuthStore.getState().auth.setUser(null)
})

test('wallet hides previously cancelled orders when returning to the page', async () => {
  useAuthStore.getState().auth.setUser({ id: 42, username: 'test', role: 1 })
  vi.mocked(api.get).mockResolvedValue({
    data: {
      success: true,
      data: {
        total: 1,
        items: [
          {
            id: 15,
            trade_no: 'ALI-cancelled',
            payment_provider: 'alipay',
            payment_method: 'alipay_direct',
            order_status: 'pending',
            cancel_requested: true,
            expires_at: 4102444800,
            amount_fen: 123,
          },
        ],
      },
    },
  })
  const client = await showPage(true, true)
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.queryByText('You have an unpaid order')).not.toBeInTheDocument()
  expect(
    screen.queryByText(
      'Closing order. Waiting for payment provider confirmation.'
    )
  ).not.toBeInTheDocument()
  client.clear()
  useAuthStore.getState().auth.setUser(null)
})

test('wallet requests actionable orders so a cancelled newer order cannot mask an older payable order', async () => {
  useAuthStore.getState().auth.setUser({ id: 42, username: 'test', role: 1 })
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage(true, true)
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith('/api/user/self/orders', {
      params: expect.objectContaining({ actionable: true }),
    })
  )
  client.clear()
  useAuthStore.getState().auth.setUser(null)
})
test('personal status filter defaults to excluding closed orders and can request closed history', async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: { items: [], total: 0 } },
  })
  const client = await showPage(true)
  expect(
    await screen.findByRole('combobox', { name: 'Status' })
  ).toHaveTextContent('Excluding closed orders')
  await userEvent.click(screen.getByRole('combobox', { name: 'Status' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Closed' }))
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/api/user/self/orders', {
      params: expect.objectContaining({ status: 'expired' }),
    })
  )
  client.clear()
})

test.each([false, true])(
  'order detail exposes reconciliation metadata only to administrators, personal scope %s',
  async (personal) => {
    const order = {
      id: 25,
      trade_no: 'ALI-retained',
      payment_provider: 'alipay',
      payment_method: 'alipay_direct',
      order_status: 'pending',
      cancel_requested: true,
      close_requested_at: 1791710000,
      close_reason: 'user_cancelled',
      checked_at: 1791710015,
      next_check_at: 1791710045,
      retry_count: 2,
      gateway_status: 'WAIT_BUYER_PAY',
      amount_fen: 100,
      frozen_quota: 100,
      create_time: 1791709900,
    }
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: {
        success: true,
        data: String(url).endsWith('/25')
          ? order
          : { items: [order], total: 1 },
      },
    }))
    const client = await showPage(personal)
    expect(await screen.findByText('Closing order')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    const detail = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(within(detail).getByText('ALI-retained')).toBeVisible()
    )
    if (personal) {
      expect(within(detail).queryByText('Next retry')).not.toBeInTheDocument()
      expect(within(detail).queryByText('Close reason')).not.toBeInTheDocument()
    } else {
      expect(within(detail).getByText('Next retry')).toBeVisible()
      expect(within(detail).getByText('Cancelled by user')).toBeVisible()
      expect(within(detail).getByText('WAIT_BUYER_PAY')).toBeVisible()
    }
    client.clear()
  }
)

test('cancelling a personal pending order asks for confirmation and refreshes its actions', async () => {
  let cancelled = false
  vi.mocked(api.get).mockImplementation(async () => ({
    data: {
      success: true,
      data: {
        total: 1,
        items: [
          {
            id: 51,
            trade_no: 'ALI-cancel-from-list',
            payment_provider: 'alipay',
            payment_method: 'alipay_direct',
            order_status: 'pending',
            expires_at: 4102444800,
            cancel_requested: cancelled,
            amount_fen: 100,
          },
        ],
      },
    },
  }))
  vi.mocked(api.post).mockImplementation(async () => {
    cancelled = true
    return { data: { success: true, data: { status: 'closing' } } }
  })
  const client = await showPage(true)
  await userEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }))
  const dialog = await screen.findByRole('alertdialog')
  expect(api.post).not.toHaveBeenCalled()
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Cancel order' })
  )
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/self/orders/51/cancel', {})
  )
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Pay' })
    ).not.toBeInTheDocument()
  )
  expect(screen.getByText('Closing order')).toBeVisible()
  client.clear()
})
