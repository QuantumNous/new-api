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
import { afterEach, expect, it } from 'vitest'

import { Response } from '../response'

afterEach(() => {
  cleanup()
})

const table = [
  '| Plain | Left | Centre | Right |',
  '| --- | :--- | :---: | ---: |',
  '| a | b | c | d |',
].join('\n')

it('starts an unaligned or left-aligned Markdown column at the reading side', () => {
  render(<Response final>{table}</Response>)

  expect(screen.getByRole('columnheader', { name: 'Plain' })).toHaveClass(
    'text-start'
  )
  expect(screen.getByRole('cell', { name: 'a' })).toHaveClass('text-start')
  expect(screen.getByRole('cell', { name: 'b' })).toHaveClass('text-start')
  expect(screen.getByRole('cell', { name: 'a' })).not.toHaveClass('text-left')
})

it('ends a right-aligned Markdown column at the far side and keeps centring', () => {
  render(<Response final>{table}</Response>)

  expect(screen.getByRole('cell', { name: 'c' })).toHaveClass('text-center')
  expect(screen.getByRole('cell', { name: 'd' })).toHaveClass('text-end')
  expect(screen.getByRole('cell', { name: 'd' })).not.toHaveClass('text-right')
})
