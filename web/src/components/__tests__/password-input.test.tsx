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
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { PasswordInput } from '../password-input'

test('the visibility toggle names the action it will take and unmasks the value', async () => {
  const user = userEvent.setup()
  render(<PasswordInput aria-label='Password' defaultValue='secret-value' />)
  const input = screen.getByLabelText('Password')
  expect(input).toHaveAttribute('type', 'password')

  await user.click(screen.getByRole('button', { name: 'Show password' }))

  expect(input).toHaveAttribute('type', 'text')
  expect(
    screen.getByRole('button', { name: 'Hide password' })
  ).toBeInTheDocument()
})
