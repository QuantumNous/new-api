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
import { describe, expect, test } from 'vitest'

import { JsonCodeEditor } from '../../json-code-editor'

// JSON is left-to-right code. Inheriting a right-to-left page direction
// right-aligns the lines, mirrors the brackets and moves the line numbers.
describe('JsonCodeEditor direction', () => {
  test('keeps the code area left-to-right inside a right-to-left page', () => {
    render(
      <div dir='rtl'>
        <JsonCodeEditor
          value='{"enabled": false}'
          onChange={() => undefined}
          ariaLabel='Policy JSON'
        />
      </div>
    )

    const textarea = screen.getByRole('textbox', { name: 'Policy JSON' })
    expect(textarea.closest('[dir]')).toHaveAttribute('dir', 'ltr')
  })

  test('keeps the toolbar in the page direction', () => {
    render(
      <div dir='rtl'>
        <JsonCodeEditor
          value='{}'
          onChange={() => undefined}
          ariaLabel='Policy JSON'
        />
      </div>
    )

    const formatButton = screen.getByRole('button', { name: 'Format JSON' })
    expect(formatButton.closest('[dir]')).toHaveAttribute('dir', 'rtl')
  })
})
