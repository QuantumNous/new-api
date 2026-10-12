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
import { afterEach, expect, it, vi } from 'vitest'

import { PermissionMatrix } from '../permission-matrix'

afterEach(() => {
  cleanup()
})

const groups = [
  {
    key: 'personal',
    labelKey: 'Personal',
    resources: [
      {
        resource: 'tokens',
        label_key: 'API keys',
        actions: [
          { action: 'read', label_key: 'View', description_key: 'View keys' },
        ],
      },
    ],
  },
]

function renderMatrix() {
  render(<PermissionMatrix groups={groups} value={{}} onChange={vi.fn()} />)
}

it('indents the grouped resource rows from the inline start', () => {
  renderMatrix()

  const row = screen.getByRole('group', { name: 'API keys' })
  expect(row).toHaveClass('ps-9', 'pe-3')
  expect(row).not.toHaveClass('pl-9', 'pr-3')
})

it('points the collapsed group chevron toward the inline end in both directions', () => {
  renderMatrix()

  const trigger = screen.getByRole('button', { name: /Personal/ })
  const chevron = trigger.querySelector('svg')
  expect(trigger).toHaveClass('text-start')
  expect(chevron).toHaveClass(
    '-rotate-90',
    'group-data-[panel-open]/trigger:rotate-0',
    'rtl:rotate-90',
    'rtl:group-data-[panel-open]/trigger:rotate-0'
  )
})
