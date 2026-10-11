import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getWechatPayOrderStatus } from '../../../api'
import { WechatPayDialog } from '../wechatpay-dialog'

vi.mock('../../../api', () => ({ getWechatPayOrderStatus: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const checkout = {
  code_url: 'weixin://wxpay/bizpayurl?pr=test',
  trade_no: 'WXtest',
  amount: '90.00',
  currency: 'CNY' as const,
  expires_at: 4102444800,
}

function renderCheckout(expiresAt = checkout.expires_at) {
  const onPaid = vi.fn()
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <WechatPayDialog
        checkout={{ ...checkout, expires_at: expiresAt }}
        onPaid={onPaid}
        onClose={onClose}
      />
    </QueryClientProvider>
  )
  return { ...result, onPaid, onClose }
}

describe('WeChat payment status', () => {
  test('shows the supplied brand image with an accessible title and responsive QR', async () => {
    vi.mocked(getWechatPayOrderStatus).mockResolvedValue({
      success: true,
      data: { status: 'pending' },
    })
    const { onClose } = renderCheckout()
    expect(screen.getByRole('dialog', { name: 'WeChat Pay' })).toBeVisible()
    expect(screen.getByRole('img', { name: 'WeChat Pay' })).toHaveAttribute(
      'src',
      '/wechat-pay.png'
    )
    expect(screen.getByTitle('WeChat Pay QR code').closest('svg')).toHaveClass(
      'h-auto',
      'w-full'
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })
  test('shows CNY quote and QR while pending, then refreshes balance only after verified success', async () => {
    vi.mocked(getWechatPayOrderStatus)
      .mockResolvedValueOnce({ success: true, data: { status: 'pending' } })
      .mockResolvedValue({ success: true, data: { status: 'success' } })
    const { onPaid } = renderCheckout()
    expect(screen.getByText('CNY 90')).toBeVisible()
    expect(screen.getByTitle('WeChat Pay QR code')).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Check payment status' })
      ).toBeEnabled()
    )
    expect(onPaid).not.toHaveBeenCalled()
    await userEvent.click(
      screen.getByRole('button', { name: 'Check payment status' })
    )
    await waitFor(() => expect(onPaid).toHaveBeenCalledOnce())
    expect(screen.getByText('Payment successful')).toBeVisible()
    expect(screen.queryByTitle('WeChat Pay QR code')).not.toBeInTheDocument()
  })
  test('expired QR is hidden while an unconfirmed payment does not update the balance', async () => {
    vi.mocked(getWechatPayOrderStatus).mockResolvedValue({
      success: true,
      data: { status: 'pending' },
    })
    const { onPaid } = renderCheckout(1)
    expect(
      screen.getByText('Payment QR code expired. Please create a new order.')
    ).toBeVisible()
    expect(screen.queryByTitle('WeChat Pay QR code')).not.toBeInTheDocument()
    expect(onPaid).not.toHaveBeenCalled()
  })
  test('failed status request shows retry feedback without marking paid', async () => {
    vi.mocked(getWechatPayOrderStatus).mockRejectedValue(
      new Error('Unavailable')
    )
    const { onPaid } = renderCheckout()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to check payment status.'
    )
    expect(onPaid).not.toHaveBeenCalled()
  })
})
