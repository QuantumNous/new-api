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
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { PAYMENT_TYPES } from '../../constants'
import type { PaymentMethod } from '../../types'
import { PaymentConfirmDialog } from './payment-confirm-dialog'

const paymentMethod: PaymentMethod = {
  name: 'Wechat Pay',
  type: PAYMENT_TYPES.WAFFO_PANCAKE,
}

function renderDialog({
  calculating = false,
  processing = false,
  paymentAmount = 80,
  discountRate = 0.8,
}: {
  calculating?: boolean
  processing?: boolean
  paymentAmount?: number
  discountRate?: number
} = {}) {
  return render(
    <PaymentConfirmDialog
      open
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
      topupAmount={100}
      paymentAmount={paymentAmount}
      paymentMethod={paymentMethod}
      calculating={calculating}
      processing={processing}
      discountRate={discountRate}
    />
  )
}

describe('PaymentConfirmDialog', () => {
  test('shows the calculated payment amount and discount details', () => {
    renderDialog()

    expect(screen.getByText('You Pay')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('You save')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeEnabled()
    expect(
      screen.queryByText('Final payment amount is calculated at checkout.')
    ).not.toBeInTheDocument()
  })

  test('keeps confirmation available while the payment amount recalculates', () => {
    renderDialog({ calculating: true })

    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeEnabled()
    expect(screen.queryByText('You save')).not.toBeInTheDocument()
  })

  test('disables confirmation only while payment processing is active', () => {
    renderDialog({ processing: true })

    expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeDisabled()
  })
})
