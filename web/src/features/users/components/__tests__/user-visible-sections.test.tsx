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
import { expect, it, vi } from 'vitest'

import { UserVisibleSections } from '../user-visible-sections'

it('reports the granted sections when a switch is toggled off and on', async () => {
  const onChange = vi.fn()
  render(
    <UserVisibleSections
      value={['dashboard', 'api_keys']}
      onChange={onChange}
    />
  )

  const dashboard = screen.getByRole('switch', { name: 'Dashboard' })
  expect(dashboard).toHaveAttribute('aria-checked', 'true')

  await userEvent.click(screen.getByRole('switch', { name: 'Usage Logs' }))
  expect(onChange).toHaveBeenLastCalledWith([
    'dashboard',
    'api_keys',
    'usage_logs',
  ])

  await userEvent.click(dashboard)
  expect(onChange).toHaveBeenLastCalledWith(['api_keys'])
})

it('treats an absent value as no granted sections', () => {
  render(<UserVisibleSections value={undefined} onChange={vi.fn()} />)
  expect(screen.getByRole('switch', { name: 'Dashboard' })).toHaveAttribute(
    'aria-checked',
    'false'
  )
})
