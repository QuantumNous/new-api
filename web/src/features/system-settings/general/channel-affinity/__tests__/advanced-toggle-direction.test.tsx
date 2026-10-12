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
import { afterEach, describe, expect, it } from 'vitest'

import { RuleEditorDialog } from '../rule-editor-dialog'

afterEach(() => {
  cleanup()
})

function renderDialog() {
  render(
    <RuleEditorDialog
      open
      onOpenChange={() => undefined}
      rule={null}
      onSave={() => undefined}
    />
  )
}

// The collapsed-state arrow is a text glyph. ▶ points to the right, which is
// backwards on a right-to-left page, so the glyph is mirrored there.
describe('rule editor advanced settings toggle', () => {
  it('mirrors the collapsed arrow in right-to-left layouts only', () => {
    renderDialog()

    const toggle = screen.getByRole('button', { name: 'Advanced Settings' })
    const arrow = toggle.querySelector('[aria-hidden="true"]')
    expect(arrow).toHaveTextContent('▶')
    expect(arrow).toHaveClass('rtl:-scale-x-100')
  })

  it('shows the expanded arrow after opening', async () => {
    renderDialog()

    const toggle = screen.getByRole('button', { name: 'Advanced Settings' })
    await userEvent.click(toggle)

    expect(toggle.querySelector('[aria-hidden="true"]')).toHaveTextContent('▼')
  })
})
