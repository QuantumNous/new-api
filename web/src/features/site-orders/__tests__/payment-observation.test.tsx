import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import type { SiteOrder } from '../api'
import { useOrderPayment } from '../use-order-payment'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => vi.restoreAllMocks())

test.each([
  'antom',
  'webmoney',
  'mixpay',
  'alipay',
  'alipay-expired',
  'antom-expired',
])(
  '%s resumed payment refreshes its owner only after server-confirmed fulfillment',
  async (provider) => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const order = {
      id: 42,
      trade_no: 'resume-test',
      payment_provider: provider.replace('-expired', ''),
    } as SiteOrder
    let status = provider.endsWith('-expired') ? 'expired' : 'paid'
    vi.mocked(api.get).mockImplementation(async () => ({
      data: { success: true, data: { ...order, order_status: status } },
    }))
    const links: Record<string, string> = {
      antom: '/payment/antom/resume-test',
      'antom-expired': '/payment/antom/resume-test',
      webmoney: 'https://merchant.wmtransfer.com/lmi/payment_utf.asp',
      mixpay: 'https://mixpay.me/code/resume-test',
      alipay: 'https://openapi.alipay.com/gateway.do',
      'alipay-expired': 'https://openapi.alipay.com/gateway.do',
    }
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          ...order,
          status: 'pending',
          expires_at: Math.floor(Date.now() / 1000) + 600,
          pay_link: links[provider],
          pay_params: {},
        },
      },
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const onPaid = vi.fn()
    const hook = renderHook(() => useOrderPayment(onPaid), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    act(() => hook.result.current.pay(order))
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/user/self/orders/42')
    )
    expect(onPaid).not.toHaveBeenCalled()
    status = 'success'
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['site-orders'] })
    })
    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1))
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['site-orders'] })
    })
    expect(onPaid).toHaveBeenCalledTimes(1)
    hook.unmount()
    client.clear()
  }
)

test.each([
  'failed',
  'expired',
  'paid_review',
  'review_closed',
  'forbidden',
  'success-review',
])('%s stops observation without reporting payment success', async (status) => {
  vi.mocked(api.get).mockReset()
  vi.spyOn(window, 'open').mockReturnValue(null)
  const order = {
    id: 7,
    trade_no: 'terminal-test',
    payment_provider: 'alipay',
  } as SiteOrder
  vi.mocked(api.post).mockResolvedValue({
    data: {
      success: true,
      data: {
        ...order,
        pay_link: 'https://openapi.alipay.com/gateway.do',
      },
    },
  })
  if (status === 'forbidden') {
    vi.mocked(api.get).mockRejectedValue({ response: { status: 403 } })
  } else {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          ...order,
          order_status: status === 'success-review' ? 'success' : status,
          review_required: status === 'success-review',
          closed_at: 1,
        },
      },
    })
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onPaid = vi.fn()
  const hook = renderHook(() => useOrderPayment(onPaid), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  act(() => hook.result.current.pay(order))
  await waitFor(() => expect(api.get).toHaveBeenCalled())
  await waitFor(() => expect(client.isFetching()).toBe(0))
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['site-orders'] })
  })
  expect(onPaid).not.toHaveBeenCalled()
  hook.unmount()
  client.clear()
})
