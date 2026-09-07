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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Combobox } from '../combobox'

const options = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google' },
  { value: 'disabled', label: 'Unavailable provider', disabled: true },
]

function Fixture() {
  const [value, setValue] = useState('openai')
  return <><Combobox options={options} value={value} onValueChange={(next) => setValue(next ?? '')} aria-label='Provider' emptyText='No matching provider' /><output>{value}</output></>
}

describe('searchable single selection', () => {
  it('searches labels and values without committing text, shows empty results, and restores the selection on Escape', async () => {
    render(<Fixture />)
    const user = userEvent.setup()
    const input = screen.getByRole('combobox', { name: 'Provider' })
    expect(input).toHaveValue('OpenAI')
    await user.click(input)
    await user.type(input, 'missing')
    expect(screen.getByText('No matching provider')).toBeVisible()
    expect(screen.getByText('openai')).toHaveTextContent('openai')
    await user.keyboard('{Escape}')
    expect(input).toHaveValue('OpenAI')
    await user.click(input)
    await user.type(input, 'gemini')
    expect(screen.getByRole('option', { name: 'Google' })).toBeVisible()
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(input).toHaveValue('Google'))
    expect(screen.getByText('gemini')).toHaveTextContent('gemini')
  })

  it('respects disabled controls and options', async () => {
    const change = vi.fn()
    const view = render(<Combobox options={options} value='openai' onValueChange={change} aria-label='Provider' disabled />)
    const user = userEvent.setup()
    expect(screen.getByRole('combobox', { name: 'Provider' })).toBeDisabled()
    view.rerender(<Combobox options={options} value='openai' onValueChange={change} aria-label='Provider' />)
    await user.click(screen.getByRole('combobox', { name: 'Provider' }))
    expect(screen.getByRole('option', { name: 'Unavailable provider' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('option', { name: 'Unavailable provider' }))
    expect(change).not.toHaveBeenCalled()
  })
})
