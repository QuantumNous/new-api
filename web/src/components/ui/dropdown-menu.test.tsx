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
import { describe, expect, test, vi } from 'vitest'

import { handleDropdownMenuItemSelect } from './dropdown-menu-events'

function createMenuEvent() {
  return Object.assign(new MouseEvent('click', { cancelable: true }), {
    preventBaseUIHandler: vi.fn(),
  }) as unknown as Parameters<typeof handleDropdownMenuItemSelect>[0] & {
    preventBaseUIHandler: ReturnType<typeof vi.fn>
  }
}

describe('DropdownMenuItem onSelect compatibility', () => {
  test('calls the Radix-style onSelect handler on item click', () => {
    const event = createMenuEvent()
    let selected = false

    handleDropdownMenuItemSelect(event, undefined, () => {
      selected = true
    })

    expect(selected).toBe(true)
    expect(event.preventBaseUIHandler).not.toHaveBeenCalled()
  })

  test('keeps the Base UI menu open when onSelect prevents default', () => {
    const event = createMenuEvent()

    handleDropdownMenuItemSelect(event, undefined, (selectEvent) => {
      selectEvent.preventDefault()
    })

    expect(event.defaultPrevented).toBe(true)
    expect(event.preventBaseUIHandler).toHaveBeenCalled()
  })
})
