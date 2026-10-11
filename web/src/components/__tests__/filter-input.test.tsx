import { act, fireEvent, render, screen } from '@testing-library/react'
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
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'

import { FilterInput } from '../filter-input'

afterEach(() => vi.useRealTimers())

test('typing is debounced and IME composition never submits unfinished text', async () => {
  vi.useFakeTimers()
  const commit = vi.fn()
  render(<FilterInput aria-label='Filter' value='' onValueChange={commit} />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'a' } })
  await act(() => vi.advanceTimersByTimeAsync(200))
  fireEvent.change(input, { target: { value: 'ab' } })
  await act(() => vi.advanceTimersByTimeAsync(399))
  expect(commit).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(commit).toHaveBeenLastCalledWith('ab')
  commit.mockClear()
  fireEvent.compositionStart(input)
  fireEvent.change(input, { target: { value: 'zhong' } })
  await act(() => vi.advanceTimersByTimeAsync(500))
  expect(commit).not.toHaveBeenCalled()
  fireEvent.compositionEnd(input, { target: { value: '中文' } })
  await act(() => vi.advanceTimersByTimeAsync(400))
  expect(commit).toHaveBeenCalledExactlyOnceWith('中文')
})

test('clearing an applied filter does not resurrect its previous draft', async () => {
  vi.useFakeTimers()
  function Fixture() {
    const [value, setValue] = useState('')
    return (
      <FilterInput aria-label='Filter' value={value} onValueChange={setValue} />
    )
  }
  render(<Fixture />)
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: 'abc' } })
  await act(() => vi.advanceTimersByTimeAsync(400))
  expect(input).toHaveValue('abc')
  fireEvent.change(input, { target: { value: '' } })
  await act(() => vi.advanceTimersByTimeAsync(800))
  expect(input).toHaveValue('')
})

test('external filter changes and unmount cancel pending input', async () => {
  vi.useFakeTimers()
  const commit = vi.fn()
  const view = render(<FilterInput value='' onValueChange={commit} />)
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'pending' },
  })
  view.rerender(<FilterInput value='restored' onValueChange={commit} />)
  await act(() => vi.advanceTimersByTimeAsync(400))
  expect(screen.getByRole('textbox')).toHaveValue('restored')
  expect(commit).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'pending' },
  })
  view.unmount()
  await act(() => vi.advanceTimersByTimeAsync(400))
  expect(commit).not.toHaveBeenCalled()
})
