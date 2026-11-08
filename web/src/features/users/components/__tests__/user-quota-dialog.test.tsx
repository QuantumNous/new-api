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
import { expect, it, vi } from 'vitest'

import { adjustUserQuota } from '../../api'
import { UserQuotaDialog } from '../user-quota-dialog'

vi.mock('../../api', () => ({ adjustUserQuota: vi.fn() }))

it('submits once when Enter is pressed while a quota adjustment is in flight', async () => {
  let resolveRequest: (value: { success: boolean }) => void = () => {}
  const pending = new Promise<{ success: boolean }>((resolve) => {
    resolveRequest = resolve
  })
  vi.mocked(adjustUserQuota).mockReturnValue(
    pending as ReturnType<typeof adjustUserQuota>
  )
  const onOpenChange = vi.fn()
  const onSuccess = vi.fn()

  render(
    <UserQuotaDialog
      open
      onOpenChange={onOpenChange}
      userId={1}
      currentQuota={100}
      onSuccess={onSuccess}
    />
  )

  const amountInput = screen.getByRole('spinbutton')
  await userEvent.type(amountInput, '5')
  await userEvent.keyboard('{Enter}')
  await userEvent.keyboard('{Enter}')

  expect(adjustUserQuota).toHaveBeenCalledTimes(1)
  expect(amountInput).toBeDisabled()

  resolveRequest({ success: true })
  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
