/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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
import { describe, expect, test, vi } from 'vitest'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'

import { StaticRowActions } from '../static-row-actions'

describe('static row actions', () => {
  test('does not trigger the row click when a portaled menu item is selected', async () => {
    const onRowClick = vi.fn()
    const onMenuItemClick = vi.fn()
    const user = userEvent.setup()

    render(
      <div onClick={onRowClick}>
        <StaticRowActions
          editLabel='Edit'
          deleteLabel='Delete'
          menuLabel='Open menu'
          onEdit={() => undefined}
          onDelete={() => undefined}
          menuItems={
            <DropdownMenuItem onClick={onMenuItemClick}>
              Find matching prices
            </DropdownMenuItem>
          }
        />
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    onRowClick.mockClear()
    await user.click(
      screen.getByRole('menuitem', { name: 'Find matching prices' })
    )

    expect(onMenuItemClick).toHaveBeenCalledOnce()
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
