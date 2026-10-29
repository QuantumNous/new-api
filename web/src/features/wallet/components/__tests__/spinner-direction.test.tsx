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
import { expect, it, vi } from 'vitest'

import { CreemConfirmDialog } from '../dialogs/creem-confirm-dialog'

it('spaces the busy spinner from the button text with a logical end margin', () => {
  render(
    <CreemConfirmDialog
      open
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
      processing
      product={{
        name: 'Starter',
        productId: 'prod_1',
        price: 5,
        currency: 'USD',
        quota: 500000,
      }}
    />
  )

  const confirm = screen.getByRole('button', { name: 'Confirm Payment' })
  const spinner = confirm.querySelector('svg.animate-spin')
  expect(spinner).toHaveClass('me-2')
  expect(spinner).not.toHaveClass('mr-2')
})
