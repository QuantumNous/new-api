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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import type { TopupInfo } from '../types'
import { RechargeFormCard } from './recharge-form-card'

const baseTopupInfo: TopupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: false,
  pay_methods: [{ name: 'Alipay', type: PAYMENT_TYPES.ALIPAY }],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
  enable_redemption: false,
}

function renderRechargeFormCard(
  topupInfo: TopupInfo,
  onPaymentMethodSelect = vi.fn()
) {
  return render(
    <RechargeFormCard
      topupInfo={topupInfo}
      presetAmounts={[]}
      selectedPreset={null}
      onSelectPreset={vi.fn()}
      topupAmount={100}
      onTopupAmountChange={vi.fn()}
      currentPaymentMinimum={1}
      onPaymentMethodSelect={onPaymentMethodSelect}
      redemptionCode=''
      onRedemptionCodeChange={vi.fn()}
      onRedeem={vi.fn()}
      redeeming={false}
      enableWaffoTopup
      waffoPayMethods={[{ name: 'Waffo Card' }]}
      onWaffoMethodSelect={vi.fn()}
      enableWaffoPancakeTopup
    />
  )
}

describe('RechargeFormCard payment methods', () => {
  test('places the Pancake fallback once in the common payment grid', () => {
    const onPaymentMethodSelect = vi.fn()
    renderRechargeFormCard(baseTopupInfo, onPaymentMethodSelect)

    const pancakeButton = screen.getByRole('button', { name: 'Wechat Pay' })
    expect(screen.getAllByRole('button', { name: 'Wechat Pay' })).toHaveLength(1)
    fireEvent.click(pancakeButton)
    expect(onPaymentMethodSelect).toHaveBeenCalledWith({
      name: 'Wechat Pay',
      type: PAYMENT_TYPES.WAFFO_PANCAKE,
    })
    expect(
      screen.getByRole('button', { name: 'Waffo Card' })
    ).toBeInTheDocument()
    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByText('Waffo Payment')).toBeInTheDocument()
    expect(screen.queryByText('Waffo Pancake Payment')).not.toBeInTheDocument()
  })

  test('does not duplicate a backend-provided Pancake method', () => {
    renderRechargeFormCard({
      ...baseTopupInfo,
      pay_methods: [
        ...baseTopupInfo.pay_methods,
        {
          name: 'Backend Pancake',
          type: PAYMENT_TYPES.WAFFO_PANCAKE,
        },
      ],
    })

    expect(
      screen.getAllByRole('button', { name: 'Backend Pancake' })
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Wechat Pay' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Waffo Card' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Waffo Pancake Payment')).not.toBeInTheDocument()
  })
})
