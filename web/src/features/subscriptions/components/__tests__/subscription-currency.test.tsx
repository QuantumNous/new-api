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
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { toIntlLocale } from '@/i18n/languages'
import { api } from '@/lib/api'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { subscriptionPlanSchema } from '../../types'
import { SubscriptionPurchaseDialog } from '../dialogs/subscription-purchase-dialog'
import { SubscriptionsMutateDrawer } from '../subscriptions-mutate-drawer'
import { SubscriptionsProvider } from '../subscriptions-provider'

const plan = subscriptionPlanSchema.parse({
  id: 1,
  title: 'Budget Pro',
  price_amount: 50,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  quota_reset_period: 'never',
  enabled: true,
  sort_order: 0,
  max_purchase_per_user: 0,
  total_amount: 4_285_714,
})

const initialConfig = useSystemConfigStore.getState().config

afterEach(() => {
  useSystemConfigStore.getState().setConfig(initialConfig)
})

it('uses the site currency for the same price when the display mode changes', () => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: DEFAULT_CURRENCY_CONFIG })
  render(
    <SubscriptionPurchaseDialog
      open
      onOpenChange={vi.fn()}
      plan={{ plan: { ...plan, currency: 'EUR' } }}
      enableOnlineTopUp
      epayMethods={[{ type: 'alipay' }]}
    />
  )
  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getByText('$50')).toBeVisible()

  act(() => {
    useSystemConfigStore.getState().setConfig({
      currency: {
        ...DEFAULT_CURRENCY_CONFIG,
        quotaDisplayType: 'CNY',
        usdExchangeRate: 7,
      },
    })
  })
  expect(dialog.getByText('¥50')).toBeVisible()
})

it('shows the same CNY price for the plan and the wallet deduction', async () => {
  useSystemConfigStore.getState().setConfig({
    currency: {
      ...DEFAULT_CURRENCY_CONFIG,
      quotaDisplayType: 'CNY',
      usdExchangeRate: 7,
    },
  })
  const pay = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  const user = userEvent.setup()
  render(
    <SubscriptionPurchaseDialog
      open
      onOpenChange={vi.fn()}
      plan={{ plan, balance_quota: 3_571_429 }}
      enableOnlineTopUp
      epayMethods={[{ type: 'alipay' }]}
      userQuota={50_000_000}
    />
  )

  const dialog = within(screen.getByRole('dialog'))
  expect(dialog.getAllByText('¥50')).toHaveLength(2)
  expect(dialog.getByText('¥60')).toBeVisible()
  await user.click(dialog.getByRole('button', { name: 'Pay with Balance' }))
  await waitFor(() =>
    expect(pay).toHaveBeenCalledWith('/api/subscription/balance/pay', {
      plan_id: 1,
      expected_quota: 3_571_429,
    })
  )
})

it('labels the price and quota fields with the active display currency', async () => {
  const { config, setConfig } = useSystemConfigStore.getState()
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })

  setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'CNY' },
  })
  const client = new QueryClient()
  const editor = render(
    <QueryClientProvider client={client}>
      <SubscriptionsProvider>
        <SubscriptionsMutateDrawer open onOpenChange={vi.fn()} />
      </SubscriptionsProvider>
    </QueryClientProvider>
  )

  try {
    const dialog = within(await screen.findByRole('dialog'))
    expect(
      dialog.getByRole('spinbutton', { name: 'Plan Price (CNY)' })
    ).toBeVisible()
    expect(
      dialog.getByRole('spinbutton', { name: 'Quota (CNY)' })
    ).toBeVisible()
    expect(dialog.queryByLabelText('Pricing currency')).toBeNull()

    act(() => setConfig({ currency: DEFAULT_CURRENCY_CONFIG }))

    expect(
      dialog.getByRole('spinbutton', { name: 'Plan Price (USD)' })
    ).toBeVisible()
    expect(
      dialog.getByRole('spinbutton', { name: 'Quota (USD)' })
    ).toBeVisible()
  } finally {
    editor.unmount()
    client.clear()
    setConfig(config)
  }
})

const currency = {
  ...DEFAULT_CURRENCY_CONFIG,
  quotaDisplayType: 'CNY' as const,
  usdExchangeRate: 7,
}

it.each([
  ['zhCN', '¥199'],
  ['zhTW', '¥199'],
  ['en', '¥199'],
  ['fr', '199 ¥'],
  ['ja', '￥199'],
  ['ru', '199 ¥'],
  ['vi', '199 ¥'],
])(
  'formats the configured price in %s without applying the exchange rate',
  (language, price) => {
    expect(
      formatLocalCurrencyAmount(
        199,
        { locale: toIntlLocale(language) },
        currency
      ).replaceAll(/\s/g, ' ')
    ).toBe(price)
  }
)

it('uses the runtime locale when the interface language is invalid', () => {
  expect(
    formatLocalCurrencyAmount(
      199,
      { locale: toIntlLocale('invalid_locale') },
      currency
    )
  ).toContain('199')
})
