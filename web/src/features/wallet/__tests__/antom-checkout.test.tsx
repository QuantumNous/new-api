import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { HostedPaymentPage } from '../hosted-payment-page'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: ReactNode; className?: string }) => (
    <a href={props.to} className={props.className}>
      {props.children}
    </a>
  ),
}))

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

test('hosted checkout redirects without loading the Element SDK', async () => {
  const replace = vi.fn()
  vi.stubGlobal('location', { search: '', replace })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const order = {
    trade_no: 'ANThosted',
    status: 'pending',
    amount: '1.00',
    expires_at: 4102444800,
  }
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: order } })
  const checkoutURL =
    'https://checkout.antom.com/checkout-page/pages/payment/index.html?sessionData=test'
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: { checkout_url: checkoutURL } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <HostedPaymentPage tradeNo='ANThosted' />
    </QueryClientProvider>
  )
  try {
    await waitFor(() => expect(replace).toHaveBeenCalledWith(checkoutURL))
    expect(api.get).not.toHaveBeenCalled()
    expect(
      document.querySelector(
        'script[src="https://js.antom.com/v2/ams-checkout.js"]'
      )
    ).toBeNull()
    expect(screen.queryByText('Payment successful')).not.toBeInTheDocument()
  } finally {
    view.unmount()
    client.clear()
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  }
})

test('hosted return waits for server verification without reopening checkout', async () => {
  const replace = vi.fn()
  vi.stubGlobal('location', { search: '?hosted_return=1', replace })
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const order = {
    trade_no: 'ANTreturned',
    status: 'pending',
    amount: '1.00',
    expires_at: 4102444800,
  }
  vi.mocked(api.post).mockResolvedValue({
    data: { success: true, data: order },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <HostedPaymentPage tradeNo='ANTreturned' />
    </QueryClientProvider>
  )
  try {
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check payment status' })
      ).toBeEnabled()
    )
    expect(api.get).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: { ...order, status: 'success' } },
    })
    await userEvent.click(
      screen.getByRole('button', { name: 'Check payment status' })
    )
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  } finally {
    view.unmount()
    client.clear()
    close.mockRestore()
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  }
})

test.each([
  ['paid', 'Payment received. Your order is being fulfilled.'],
  ['expired', 'Closed'],
  ['failed', 'Payment failed'],
])('hosted return displays %s distinctly', async (status, message) => {
  vi.stubGlobal('location', { search: '?hosted_return=1', replace: vi.fn() })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.mocked(api.post).mockResolvedValue({
    data: {
      success: true,
      data: {
        trade_no: 'ANTstate',
        status,
        amount: '1.00',
        expires_at: 1,
      },
    },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <HostedPaymentPage tradeNo='ANTstate' />
    </QueryClientProvider>
  )
  try {
    expect(await screen.findByText(message)).toBeVisible()
    expect(
      screen.queryByText(
        'Payment time has ended. Waiting for the final payment result.'
      )
    ).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    if (status !== 'paid') {
      expect(
        screen.queryByRole('button', { name: 'Check payment status' })
      ).not.toBeInTheDocument()
    }
  } finally {
    view.unmount()
    client.clear()
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  }
})

test('returned pending order never offers a second payment', async () => {
  const replace = vi.fn()
  vi.stubGlobal('location', { search: '?hosted_return=1', replace })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.mocked(api.post).mockResolvedValue({
    data: {
      success: true,
      data: {
        trade_no: 'ANTresume',
        status: 'pending',
        expires_at: 4102444800,
        pay_link: '/payment/antom/ANTresume',
      },
    },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <HostedPaymentPage tradeNo='ANTresume' />
    </QueryClientProvider>
  )
  try {
    await screen.findByRole('button', { name: 'Check payment status' })
    expect(
      screen.queryByRole('button', { name: 'Open payment page' })
    ).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
    expect(api.post).toHaveBeenCalledTimes(1)
  } finally {
    view.unmount()
    client.clear()
    vi.unstubAllGlobals()
    vi.resetAllMocks()
  }
})

test.each([401, 403, 404])(
  'stops automatic polling on HTTP %s',
  async (status) => {
    vi.stubGlobal('location', { search: '?hosted_return=1', replace: vi.fn() })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(api.post).mockRejectedValue({ response: { status } })
    const view = render(
      <QueryClientProvider client={client}>
        <HostedPaymentPage tradeNo='ANTdenied' />
      </QueryClientProvider>
    )
    try {
      await screen.findByText('Oops! Something went wrong')
      vi.useFakeTimers()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15000)
      })
      expect(api.post).toHaveBeenCalledTimes(1)
      expect(api.get).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'Open payment page' })
      ).not.toBeInTheDocument()
    } finally {
      view.unmount()
      client.clear()
      vi.useRealTimers()
      vi.unstubAllGlobals()
      vi.resetAllMocks()
    }
  }
)

test.each(['success', 'pending', 'failed', 'paid'])(
  'MixPay return verifies %s without reopening payment',
  async (status) => {
    vi.stubGlobal('location', { search: '?status=success', replace: vi.fn() })
    const close = vi.spyOn(window, 'close').mockImplementation(() => {})
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          trade_no: 'MXreturn',
          status,
          gateway_status: 'confirming',
          expires_at: 4102444800,
        },
      },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <HostedPaymentPage provider='mixpay' tradeNo='MXreturn' />
      </QueryClientProvider>
    )
    try {
      await screen.findByRole('status')
      expect(api.post).toHaveBeenCalledWith(
        '/api/user/mixpay/order/MXreturn/recheck',
        {}
      )
      if (status === 'success')
        {await waitFor(() => expect(close).toHaveBeenCalledOnce())}
      else expect(close).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('button', { name: 'Open payment page' })
      ).not.toBeInTheDocument()
      expect(window.location.replace).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      client.clear()
      close.mockRestore()
      vi.unstubAllGlobals()
      vi.resetAllMocks()
    }
  }
)
