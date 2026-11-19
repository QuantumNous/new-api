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
import { act, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { beforeEach, expect, it, vi } from 'vitest'

import { BillingHistoryDialog } from '@/features/wallet/components/dialogs/billing-history-dialog'
import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import { RechargeFormCard } from '../components/recharge-form-card'
import {
  getDiscountRateForPaymentType,
  getMatchedAmountDiscount,
  mergePresetAmounts,
} from '../lib'

const i18n = createInstance()

beforeEach(async () => {
  await i18n.use(initReactI18next).init({
    lng: 'zh',
    fallbackLng: false,
    nsSeparator: false,
    resources: { en, zh },
    interpolation: { escapeValue: false },
  })
})

it('translates billing history statuses and updates them when the language changes', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        total: 3,
        items: ['success', 'pending', 'expired'].map((status, id) => ({
          id,
          status,
          amount: 10,
          money: 10,
          trade_no: `order-${id}`,
          payment_method: 'stripe',
          create_time: 1,
        })),
      },
    },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <BillingHistoryDialog open onOpenChange={vi.fn()} />
    </I18nextProvider>
  )
  await screen.findByText('order-0')
  for (const label of ['成功', '待确认', '已过期']) {
    expect(screen.getByText(label)).toBeVisible()
  }
  await act(() => i18n.changeLanguage('en'))
  for (const label of ['Success', 'Pending', 'Expired']) {
    expect(screen.getByText(label)).toBeVisible()
  }
})

it.each([
  { priceRatio: 7.3, paid: '584', saved: '146', full: '146' },
  { priceRatio: 0.000123, paid: '0.0098', saved: '0.0025', full: '0.0025' },
])(
  'translates recharge presets and minimum amount without changing precision at price ratio $priceRatio',
  async ({ priceRatio, paid, saved, full }) => {
    render(
      <I18nextProvider i18n={i18n}>
        <RechargeFormCard
          topupInfo={{
            enable_online_topup: true,
            enable_stripe_topup: false,
            pay_methods: [],
            min_topup: 1,
            stripe_min_topup: 1,
            amount_options: [100, 20],
            discount: {},
          }}
          presetAmounts={[{ value: 100, discount: 0.8 }, { value: 20 }]}
          selectedPreset={null}
          topupAmount={1}
          paymentAmount={priceRatio}
          priceRatio={priceRatio}
          calculating={false}
          paymentLoading={null}
          redemptionCode=''
          redeeming={false}
          onSelectPreset={vi.fn()}
          onTopupAmountChange={vi.fn()}
          onPaymentMethodSelect={vi.fn()}
          onRedemptionCodeChange={vi.fn()}
          onRedeem={vi.fn()}
        />
      </I18nextProvider>
    )
    expect(screen.getByRole('button', { name: /^100 / })).toHaveTextContent(
      `优惠 20%支付 ${paid} • 节省 ${saved}`
    )
    expect(screen.getByRole('button', { name: /^20 / })).toHaveTextContent(
      `支付 ${full}`
    )
    expect(screen.getByPlaceholderText('最低 1')).toBeVisible()
    await act(() => i18n.changeLanguage('en'))
    expect(screen.getByRole('button', { name: /^100 / })).toHaveTextContent(
      `20% OFFPay ${paid} • Save ${saved}`
    )
    expect(screen.getByRole('button', { name: /^20 / })).toHaveTextContent(
      `Pay ${full}`
    )
    expect(screen.getByPlaceholderText('Minimum 1')).toBeVisible()
  }
)

it('selects the highest qualifying positive discount threshold', () => {
  const discounts = { 100: 0.95, 200: 0.9, 50: 0 }
  expect(getMatchedAmountDiscount(99, discounts)).toBe(1)
  expect(getMatchedAmountDiscount(100, discounts)).toBe(0.95)
  expect(getMatchedAmountDiscount(105, discounts)).toBe(0.95)
  expect(getMatchedAmountDiscount(250, discounts)).toBe(0.9)
})

it('keeps exact-key lookup for Stripe and tiered thresholds for other methods', () => {
  const discounts = { 100: 0.95, 200: 0.9 }
  expect(getDiscountRateForPaymentType(100, discounts, 'stripe')).toBe(0.95)
  expect(getDiscountRateForPaymentType(105, discounts, 'stripe')).toBe(1)
  expect(getDiscountRateForPaymentType(105, discounts, 'waffo_pancake')).toBe(
    0.95
  )
  expect(getDiscountRateForPaymentType(250, discounts, 'waffo')).toBe(0.9)
})

it('applies tiered thresholds when merging preset amounts', () => {
  expect(mergePresetAmounts([50, 105, 200], { 100: 0.95 })).toEqual([
    { value: 50, discount: 1 },
    { value: 105, discount: 0.95 },
    { value: 200, discount: 0.95 },
  ])
})

it('displays tiered discount savings on recharge preset cards', () => {
  render(
    <I18nextProvider i18n={i18n}>
      <RechargeFormCard
        topupInfo={{
          enable_online_topup: true,
          enable_stripe_topup: false,
          pay_methods: [],
          min_topup: 1,
          stripe_min_topup: 1,
          amount_options: [200],
          discount: { 100: 0.95 },
        }}
        presetAmounts={[{ value: 200, discount: 1 }]}
        selectedPreset={null}
        topupAmount={105}
        paymentAmount={99.75}
        priceRatio={1}
        calculating={false}
        paymentLoading={null}
        redemptionCode=''
        redeeming={false}
        onSelectPreset={vi.fn()}
        onTopupAmountChange={vi.fn()}
        onPaymentMethodSelect={vi.fn()}
        onRedemptionCodeChange={vi.fn()}
        onRedeem={vi.fn()}
      />
    </I18nextProvider>
  )

  expect(screen.getByRole('button', { name: /^200 / })).toHaveTextContent(
    '优惠 5%支付 190 • 节省 10'
  )
})
