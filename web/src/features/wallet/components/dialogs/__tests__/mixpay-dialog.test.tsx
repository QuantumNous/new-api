import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { getAntomPayment } from '../../../antom'
import { getMixPayPayment, type MixPayCheckout } from '../../../mixpay'
import { getWebMoneyPayment } from '../../../webmoney'
import { MixPayDialog } from '../mixpay-dialog'

vi.mock('../../../antom', () => ({
  getAntomPayment: vi.fn(),
  getAntomCheckoutURL: vi.fn(),
}))
vi.mock('../../../webmoney', () => ({ getWebMoneyPayment: vi.fn() }))
vi.mock('../../../mixpay', () => ({ getMixPayPayment: vi.fn() }))
afterEach(() => vi.restoreAllMocks())
const pending: MixPayCheckout = {
  payment_provider: 'mixpay',
  trade_no: 'MXtest',
  amount: '10.00',
  currency: 'USD',
  expires_at: 4102444800,
  status: 'pending',
  gateway_status: 'confirming',
  creation_state: 'ready',
  pay_link: 'https://mixpay.me/code/test',
  review_required: false,
}
function renderCheckout() {
  const onPaid = vi.fn()
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <MixPayDialog tradeNo='MXtest' onPaid={onPaid} onClose={onClose} />
    </QueryClientProvider>
  )
  return { ...result, onPaid, onClose, client }
}

test('expired pending payment remains queryable and later verified success refreshes once', async () => {
  vi.mocked(getMixPayPayment)
    .mockResolvedValueOnce({ ...pending, expires_at: 1 })
    .mockResolvedValue({ ...pending, status: 'success' })
  const { onPaid, client } = renderCheckout()
  expect(
    await screen.findByText(
      'Payment time has ended. Waiting for the final payment result.'
    )
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Open payment page' })
  ).not.toBeInTheDocument()
  expect(onPaid).not.toHaveBeenCalled()
  await userEvent.click(
    screen.getByRole('button', { name: 'Check payment status' })
  )
  await waitFor(() => expect(onPaid).toHaveBeenCalledOnce())
  await client.invalidateQueries({ queryKey: ['mixpay-order', 'MXtest'] })
  expect(onPaid).toHaveBeenCalledOnce()
})

test('pending checkout opens official page and Escape closes without cancelling or reporting paid', async () => {
  vi.mocked(getMixPayPayment).mockResolvedValue(pending)
  const replace = vi.fn()
  const open = vi.spyOn(window, 'open').mockReturnValue({
    opener: null,
    location: { replace },
    focus: vi.fn(),
    close: vi.fn(),
  } as unknown as Window)
  const { onPaid, onClose } = renderCheckout()
  await userEvent.click(
    await screen.findByRole('button', { name: 'Open payment page' })
  )
  expect(open).toHaveBeenCalledWith(
    '',
    '_blank',
    expect.stringContaining('popup=yes')
  )
  expect(replace).toHaveBeenCalledWith(pending.pay_link)
  expect(
    screen.queryByRole('button', { name: /cancel/i })
  ).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
  expect(onPaid).not.toHaveBeenCalled()
})

test.each([
  { ...pending, status: 'paid' },
  { ...pending, review_required: true },
  { ...pending, status: 'success', review_required: true },
  { ...pending, status: 'failed' },
  { ...pending, pay_link: 'https://mixpay.me.evil.test/code/test' },
])('does not open unsafe or non-payable checkout: %j', async (order) => {
  vi.mocked(getMixPayPayment).mockResolvedValue(order)
  const { onPaid } = renderCheckout()
  await screen.findByText('USD 10.00')
  expect(
    screen.queryByRole('button', { name: 'Open payment page' })
  ).not.toBeInTheDocument()
  expect(onPaid).not.toHaveBeenCalled()
})

test('query failure allows retry and never reports paid', async () => {
  vi.mocked(getMixPayPayment)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(pending)
  const { onPaid } = renderCheckout()
  expect(await screen.findByRole('alert')).toBeVisible()
  await userEvent.click(
    screen.getByRole('button', { name: 'Check payment status' })
  )
  expect(
    await screen.findByRole('button', { name: 'Open payment page' })
  ).toBeEnabled()
  expect(onPaid).not.toHaveBeenCalled()
})

test('ready checkout opens automatically once and keeps spaced responsive actions after polling', async () => {
  vi.mocked(getMixPayPayment).mockResolvedValue(pending)
  const replace = vi.fn()
  const open = vi.spyOn(window, 'open').mockReturnValue({
    opener: null,
    location: { replace },
    focus: vi.fn(),
    close: vi.fn(),
  } as unknown as Window)
  const { client } = renderCheckout()
  await waitFor(() => expect(replace).toHaveBeenCalledWith(pending.pay_link))
  await client.invalidateQueries({ queryKey: ['mixpay-order', 'MXtest'] })
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(open).toHaveBeenCalledOnce()
  const pay = screen.getByRole('button', { name: 'Open payment page' })
  expect(pay.parentElement).toHaveClass('flex', 'flex-wrap', 'gap-3')
  expect(pay).toHaveClass('w-full', 'sm:w-auto')
  expect(
    screen.getByRole('button', { name: 'Check payment status' })
  ).toHaveClass('w-full', 'sm:w-auto')
  client.clear()
})

test('blocked automatic popup is not retried on polling and can be opened manually', async () => {
  vi.mocked(getMixPayPayment).mockResolvedValue(pending)
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const { client } = renderCheckout()
  await waitFor(() => expect(open).toHaveBeenCalledOnce())
  await client.invalidateQueries({ queryKey: ['mixpay-order', 'MXtest'] })
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(open).toHaveBeenCalledOnce()
  await userEvent.click(
    screen.getByRole('button', { name: 'Open payment page' })
  )
  expect(open).toHaveBeenCalledTimes(2)
  client.clear()
})

test('WebMoney opens a POST checkout once and credits only after server confirmation', async () => {
  const order = {
    ...pending,
    payment_provider: 'webmoney' as const,
    trade_no: 'WMtest',
    currency: 'WMT',
    pay_link: 'https://merchant.wmtransfer.com/lmi/payment_utf.asp',
    pay_params: { LMI_PAYMENT_NO: '10', LMI_PAYMENT_AMOUNT: '10.00' },
  }
  vi.mocked(getWebMoneyPayment).mockResolvedValue(order)
  const doc = document.implementation.createHTMLDocument('checkout')
  const submit = vi
    .spyOn(HTMLFormElement.prototype, 'submit')
    .mockImplementation(() => {})
  const open = vi.spyOn(window, 'open').mockReturnValue({
    document: doc,
    opener: null,
    focus: vi.fn(),
    close: vi.fn(),
  } as unknown as Window)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onPaid = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <MixPayDialog
        provider='webmoney'
        tradeNo='WMtest'
        onClose={vi.fn()}
        onPaid={onPaid}
      />
    </QueryClientProvider>
  )
  await screen.findByText('WMT 10.00')
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  expect(doc.querySelector('form')?.getAttribute('action')).toBe(order.pay_link)
  expect(
    doc.querySelector('input[name="LMI_PAYMENT_NO"]')?.getAttribute('value')
  ).toBe('10')
  expect(onPaid).not.toHaveBeenCalled()
  await client.invalidateQueries({ queryKey: ['webmoney-order', 'WMtest'] })
  expect(open).toHaveBeenCalledTimes(1)
  vi.mocked(getWebMoneyPayment).mockResolvedValue({
    ...order,
    status: 'success',
  })
  await client.invalidateQueries({ queryKey: ['webmoney-order', 'WMtest'] })
  await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1))
})

test.each(['webmoney', 'antom'] as const)(
  '%s local expiry retains late-payment checking without reopening checkout',
  async (provider) => {
    vi.mocked(provider === 'webmoney' ? getWebMoneyPayment : getAntomPayment)
      .mockResolvedValueOnce({
        ...pending,
        payment_provider: provider,
        status: 'expired',
        closure_confirmed: false,
        expires_at: 1,
        pay_link: '',
      })
      .mockResolvedValue({
        ...pending,
        payment_provider: provider,
        status: 'success',
        pay_link: '',
      })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const onPaid = vi.fn()
    const view = render(
      <QueryClientProvider client={client}>
        <MixPayDialog
          provider={provider}
          tradeNo='MXtest'
          onPaid={onPaid}
          onClose={() => {}}
        />
      </QueryClientProvider>
    )
    expect(
      await screen.findByText(
        'Payment time has ended. Waiting for the final payment result.'
      )
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Open payment page' })
    ).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Check payment status' })
    )
    await waitFor(() => expect(onPaid).toHaveBeenCalledOnce())
    view.unmount()
    client.clear()
  }
)

test('uncertain MixPay creation explains recovery and opens only the recovered link', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  vi.mocked(getMixPayPayment)
    .mockResolvedValueOnce({
      ...pending,
      creation_state: 'recovering',
      gateway_status: 'unpaid',
      pay_link: '',
    })
    .mockResolvedValue({ ...pending, gateway_status: 'unpaid' })
  const { onPaid, client, unmount } = renderCheckout()
  expect(
    await screen.findByText('Recovering payment link. Please keep this order.')
  ).toBeVisible()
  expect(open).not.toHaveBeenCalled()
  await userEvent.click(
    screen.getByRole('button', { name: 'Check payment status' })
  )
  await waitFor(() => expect(open).toHaveBeenCalledOnce())
  expect(onPaid).not.toHaveBeenCalled()
  unmount()
  client.clear()
})
