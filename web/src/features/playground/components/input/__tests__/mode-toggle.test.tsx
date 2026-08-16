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
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { PlaygroundModeToggle } = await import('../playground-mode-toggle')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'Generation mode': 'Generation mode',
        Text: 'Text',
        Image: 'Image',
      },
    },
  },
})

function ToggleHarness(props: {
  mode: 'text' | 'image'
  onModeChange: (mode: 'text' | 'image') => void
  disabled?: boolean
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <PlaygroundModeToggle
        mode={props.mode}
        onModeChange={props.onModeChange}
        disabled={props.disabled}
      />
    </I18nextProvider>
  )
}

describe('playground mode toggle', () => {
  test('marks the active mode as pressed and the other as not pressed', () => {
    render(<ToggleHarness mode='text' onModeChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByRole('button', { name: 'Image' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  test('reports the newly selected mode when the inactive item is clicked', async () => {
    const onModeChange = vi.fn()
    render(<ToggleHarness mode='text' onModeChange={onModeChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Image' }))

    expect(onModeChange).toHaveBeenCalledWith('image')
  })

  test('keeps the active mode when the already selected item is clicked', async () => {
    const onModeChange = vi.fn()
    render(<ToggleHarness mode='image' onModeChange={onModeChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Image' }))

    expect(onModeChange).not.toHaveBeenCalled()
  })

  test('disables both mode items while a request is running', () => {
    render(<ToggleHarness mode='text' onModeChange={vi.fn()} disabled />)

    expect(screen.getByRole('button', { name: 'Text' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Image' })).toBeDisabled()
  })
})
