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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { quoteSubscriptionDirect, paySubscriptionDirect } from '../../../api'
import type { PlanRecord } from '../../../types'
import { SubscriptionPurchaseDialog } from '../subscription-purchase-dialog'

vi.mock('../../../api', async (original) => ({
  ...(await original<typeof import('../../../api')>()),
  quoteSubscriptionDirect: vi.fn(),
  paySubscriptionDirect: vi.fn(),
}))
const originalCurrency = useSystemConfigStore.getState().config.currency
afterEach(() => {
  vi.resetAllMocks()
  useSystemConfigStore.getState().setConfig({ currency: originalCurrency })
})

const configuredIconUrl = 'https://example.com/payments/local-pay.svg'

const plan: PlanRecord = {
  plan: {
    id: 1,
    title: 'Starter',
    price_amount: 10,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    quota_reset_period: 'never',
    enabled: true,
    sort_order: 0,
    allow_balance_pay: false,
    allow_wallet_overflow: true,
    max_purchase_per_user: 0,
    total_amount: 0,
  },
}

describe('subscription purchase dialog payment methods', () => {
  test('uses the configured payment icon for an Epay method', () => {
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <SubscriptionPurchaseDialog
          open
          onOpenChange={vi.fn()}
          plan={plan}
          enableOnlineTopUp
          epayMethods={[
            {
              type: 'local-pay',
              name: 'Local Pay',
              icon: configuredIconUrl,
            },
          ]}
        />
      </QueryClientProvider>
    )

    expect(screen.getByRole('img', { name: 'Local Pay' })).toHaveAttribute(
      'src',
      configuredIconUrl
    )
  })
})

test('offers direct payments and uses server quote when starting a one-time WeChat subscription', async () => {
  vi.mocked(quoteSubscriptionDirect).mockResolvedValue({
    success: true,
    data: '70.00',
  })
  vi.mocked(paySubscriptionDirect).mockResolvedValue({
    success: true,
    data: {
      code_url: 'weixin://test-sub',
      trade_no: 'SUBWXtest',
      amount: '70.00',
      currency: 'CNY',
      expires_at: 4102444800,
    },
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SubscriptionPurchaseDialog
        open
        plan={plan}
        enableAlipay
        enableWechatPay
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  )
  expect(screen.getByRole('radio', { name: 'Alipay' })).toBeVisible()
  await userEvent.click(screen.getByRole('radio', { name: 'WeChat Pay' }))
  expect(await screen.findByText('CNY 70.00')).toBeVisible()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  )
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(paySubscriptionDirect).toHaveBeenCalledWith('wechatpay', {
    plan_id: 1,
    expected_amount: '70.00',
    mobile: expect.any(Boolean),
  })
  expect(await screen.findByTitle('WeChat Pay QR code')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Scan with WeChat to pay. Your subscription activates after payment is verified.'
    )
  ).toBeVisible()
  client.clear()
})

test('failed subscription quote keeps Continue disabled', async () => {
  vi.mocked(quoteSubscriptionDirect).mockRejectedValue(new Error('Unavailable'))
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SubscriptionPurchaseDialog
        open
        plan={plan}
        enableAlipay
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  )
  await waitFor(() => expect(quoteSubscriptionDirect).toHaveBeenCalled())
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  expect(paySubscriptionDirect).not.toHaveBeenCalled()
  client.clear()
})

test('a CNY plan uses its fixed yuan price and the equivalent wallet quota', () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...originalCurrency,
      quotaDisplayType: 'CNY',
      usdExchangeRate: 7,
      quotaPerUnit: 500000,
    },
  })
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <SubscriptionPurchaseDialog
        open
        plan={{
          plan: {
            ...plan.plan,
            currency: 'CNY',
            price_amount: 7,
            allow_balance_pay: true,
          },
        }}
        userQuota={500000}
        onOpenChange={vi.fn()}
      />
    </QueryClientProvider>
  )
  expect(screen.getAllByText('¥7').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  client.clear()
})
