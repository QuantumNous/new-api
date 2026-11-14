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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  PaymentMethodDialog,
  type PaymentMethodData,
} from '../payment-method-dialog'

function renderDialog(editData: PaymentMethodData) {
  const onSave = vi.fn()
  render(
    <PaymentMethodDialog
      open
      onOpenChange={() => {}}
      onSave={onSave}
      editData={editData}
    />
  )
  return { onSave, user: userEvent.setup() }
}

describe('payment method channel', () => {
  it('saves the stripe provider when Stripe is chosen for an Alipay method', async () => {
    const { onSave, user } = renderDialog({ name: 'Alipay', type: 'alipay' })
    const channel = screen.getByRole('combobox', { name: 'Payment channel' })
    expect(channel).toHaveValue('Epay')

    await user.click(channel)
    await user.click(screen.getByRole('option', { name: 'Stripe' }))
    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith({
      name: 'Alipay',
      type: 'alipay',
      icon: 'SiAlipay',
      provider: 'stripe',
    })
  })

  it('saves no provider field when a WeChat Pay method stays on Epay', async () => {
    const { onSave, user } = renderDialog({ name: 'WeChat', type: 'wxpay' })
    expect(
      screen.getByRole('combobox', { name: 'Payment channel' })
    ).toHaveValue('Epay')

    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('provider')
  })

  it('shows Stripe as the channel of a method already routed through Stripe', () => {
    renderDialog({ name: 'WeChat', type: 'wxpay', provider: 'stripe' })

    expect(
      screen.getByRole('combobox', { name: 'Payment channel' })
    ).toHaveValue('Stripe')
  })

  it('offers no channel for other payment types and drops a stripe provider on save', async () => {
    const { onSave, user } = renderDialog({
      name: 'Custom',
      type: 'custom1',
      provider: 'stripe',
    })
    expect(
      screen.queryByRole('combobox', { name: 'Payment channel' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('provider')
  })
})
