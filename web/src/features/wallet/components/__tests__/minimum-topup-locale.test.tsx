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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RechargeFormCard } from '../recharge-form-card'

// The entered amount (10) is below both methods' minimum (50 and 60), so
// each shows its minimum; the custom amount field shows the general one (1).
// The visible label ends with the minimum; its accessible name and tooltip
// name it in full.
function renderCard(): void {
  render(
    <RechargeFormCard
      topupInfo={{
        enable_online_topup: true,
        enable_stripe_topup: false,
        pay_methods: [{ name: 'Alipay', type: 'alipay', min_topup: 50 }],
        min_topup: 1,
        stripe_min_topup: 1,
        amount_options: [],
        discount: {},
      }}
      presetAmounts={[]}
      selectedPreset={null}
      topupAmount={10}
      paymentAmount={10}
      calculating={false}
      paymentLoading={null}
      redemptionCode=''
      redeeming={false}
      onSelectPreset={vi.fn()}
      onTopupAmountChange={vi.fn()}
      onPaymentMethodSelect={vi.fn()}
      onRedemptionCodeChange={vi.fn()}
      onRedeem={vi.fn()}
      enableWaffoTopup
      waffoPayMethods={[{ name: 'Card' }]}
      waffoMinTopup={60}
      onWaffoMethodSelect={vi.fn()}
    />
  )
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('recharge minimum amounts', () => {
  it.each([
    { language: 'English', lng: 'en', digits: ['1', '50', '60'] },
    { language: 'Persian', lng: 'fa', digits: ['۱', '۵۰', '۶۰'] },
  ])(
    'in $language, writes the minimum amounts in the same digits as the amount to pay',
    async ({ lng, digits }) => {
      await i18next.changeLanguage(lng)
      renderCard()
      const [general, alipay, card] = digits
      expect(screen.getByPlaceholderText(`Minimum ${general}`)).toBeVisible()
      expect(
        screen.getByRole('button', {
          name: `Alipay. Minimum topup amount: ${alipay}`,
        })
      ).toHaveTextContent(new RegExp(`${alipay}$`))
      expect(
        screen.getByRole('button', {
          name: `Card. Minimum topup amount: ${card}`,
        })
      ).toHaveTextContent(new RegExp(`${card}$`))
    }
  )
})
