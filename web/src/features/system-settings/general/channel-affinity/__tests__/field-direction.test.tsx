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

// The rule name is free text, so it takes its direction from its content.
// Regexes stay left to right whatever they match.
describe('rule editor field direction', () => {
  it('lays out a Persian rule name right to left', async () => {
    renderDialog()

    const name = screen.getByRole('textbox', { name: 'Name *' })
    await userEvent.type(name, 'ترجیح بر اساس گفتگو')

    expect(name.matches(':dir(rtl)')).toBe(true)
  })

  it('keeps a model regex with Persian text left to right', async () => {
    renderDialog()

    const regex = screen.getByPlaceholderText(/\^gpt-4o/)
    await userEvent.type(regex, '^مدل-.*$')

    expect(regex.matches(':dir(ltr)')).toBe(true)
  })
})
