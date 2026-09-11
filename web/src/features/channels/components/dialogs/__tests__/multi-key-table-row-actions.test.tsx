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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'

import { MultiKeyTableRowActions } from '../multi-key-table-row-actions'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(() => {
  cleanup()
})

test('renders a test button that triggers onTest with the key index', () => {
  const onTest = vi.fn()
  render(
    <MultiKeyTableRowActions
      keyIndex={2}
      status={1}
      canDelete
      onTest={onTest}
      onAction={vi.fn()}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: 'Test' }))

  expect(onTest).toHaveBeenCalledTimes(1)
  expect(onTest).toHaveBeenCalledWith(2)
})

test('shows a spinner and disables the button while the key is being tested', () => {
  render(
    <MultiKeyTableRowActions
      keyIndex={0}
      status={1}
      canDelete
      isTesting
      onTest={vi.fn()}
      onAction={vi.fn()}
    />
  )

  const testButton = screen.getByRole('button', { name: 'Testing...' })
  expect(testButton).toBeDisabled()
})

test('disables the test button while another key test is running', () => {
  render(
    <MultiKeyTableRowActions
      keyIndex={1}
      status={1}
      canDelete
      disabled
      onTest={vi.fn()}
      onAction={vi.fn()}
    />
  )

  expect(screen.getByRole('button', { name: 'Test' })).toBeDisabled()
})