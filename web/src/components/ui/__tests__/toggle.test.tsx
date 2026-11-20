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
import { describe, expect, it } from 'vitest'

import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

describe('Toggle pressed state', () => {
  it('uses primary border and tint when a group item is selected', () => {
    render(
      <ToggleGroup value={['90']} variant='outline'>
        <ToggleGroupItem value='30'>30</ToggleGroupItem>
        <ToggleGroupItem value='90'>90</ToggleGroupItem>
      </ToggleGroup>
    )

    const selected = screen.getByRole('button', { name: '90' })

    expect(selected).toHaveAttribute('aria-pressed', 'true')
    expect(selected).toHaveClass(
      'aria-pressed:border-primary',
      'aria-pressed:bg-primary/10'
    )
  })

  it('does not fall back to the muted surface when a toggle is pressed', () => {
    render(<Toggle pressed>On</Toggle>)

    // --muted is nearly identical to --popover, so it hides the selection in dialogs.
    expect(screen.getByRole('button', { name: 'On' })).not.toHaveClass(
      'aria-pressed:bg-muted'
    )
  })

  it('keeps the foreground text color when a toggle is pressed', () => {
    render(<Toggle pressed>On</Toggle>)

    // text-primary on the tint falls below 4.5:1 in most theme presets.
    expect(screen.getByRole('button', { name: 'On' })).not.toHaveClass(
      'aria-pressed:text-primary'
    )
  })
})
