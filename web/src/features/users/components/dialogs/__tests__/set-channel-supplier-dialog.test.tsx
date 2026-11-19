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
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { SetChannelSupplierDialog } from '../set-channel-supplier-dialog'

const discountMessage =
  'Payable discount must be greater than 0 and at most 1, with at most 4 decimal places'

function renderDialog(currentDiscount?: number | null) {
  const onConfirm = vi.fn(async () => undefined)
  render(
    <SetChannelSupplierDialog
      open
      onOpenChange={() => undefined}
      username='target-user'
      currentDiscount={currentDiscount}
      onConfirm={onConfirm}
    />
  )
  return onConfirm
}

afterEach(() => {
  cleanup()
})

it.each([
  ['empty', ''],
  ['zero', '0'],
  ['above one', '1.0001'],
  ['too many decimals', '0.12345'],
])(
  'a %s discount is refused with the message and no confirmation',
  async (_name, value) => {
    const onConfirm = renderDialog()
    const field = screen.getByLabelText('Payable Discount')
    if (value !== '') await userEvent.type(field, value)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.getByText(discountMessage)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  }
)

it('a comma decimal separator is accepted and confirmed as a number', async () => {
  const onConfirm = renderDialog()
  await userEvent.type(screen.getByLabelText('Payable Discount'), '0,85')
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(onConfirm).toHaveBeenCalledWith(0.85)
})

it('the stored discount is prefilled and can be confirmed unchanged', async () => {
  const onConfirm = renderDialog(0.9)
  expect(screen.getByLabelText('Payable Discount')).toHaveValue('0.9')
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(onConfirm).toHaveBeenCalledWith(0.9)
})

it('a supplier that never had a discount opens with an empty field', async () => {
  renderDialog(null)
  expect(screen.getByLabelText('Payable Discount')).toHaveValue('')
})
