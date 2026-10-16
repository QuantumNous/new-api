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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DirectionProvider, useDirection } from '@/context/direction-provider'

function DirectionControls() {
  const direction = useDirection()
  return (
    <>
      <output aria-label='Direction'>{direction.dir}</output>
      <button type='button' onClick={() => direction.setDir('ltr')}>
        LTR
      </button>
      <button type='button' onClick={() => direction.setDir('rtl')}>
        RTL
      </button>
    </>
  )
}

function renderProvider() {
  return render(
    <DirectionProvider>
      <DirectionControls />
    </DirectionProvider>
  )
}

async function switchLanguage(language: string) {
  await act(async () => {
    await i18next.changeLanguage(language)
  })
}

describe('DirectionProvider', () => {
  beforeEach(async () => {
    document.cookie = 'dir=; path=/; max-age=0'
    await i18next.changeLanguage('en')
  })

  afterEach(async () => {
    document.cookie = 'dir=; path=/; max-age=0'
    await i18next.changeLanguage('en')
    document.documentElement.removeAttribute('dir')
    document.documentElement.removeAttribute('lang')
  })

  it('switches the page to rtl and lang fa when Persian is selected', async () => {
    renderProvider()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')

    await switchLanguage('fa')

    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.documentElement).toHaveAttribute('lang', 'fa')
  })

  it('restores ltr when switching from Persian to another language', async () => {
    await i18next.changeLanguage('fa')
    renderProvider()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')

    await switchLanguage('zhCN')

    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })

  it('keeps a manual direction until the language changes', async () => {
    const user = userEvent.setup()
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'RTL' }))
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.cookie).toContain('dir=rtl')

    await switchLanguage('fr')

    expect(screen.getByLabelText('Direction')).toHaveTextContent('ltr')
    expect(document.cookie).not.toContain('dir=rtl')
  })

  it('lets a Persian user force ltr with the manual toggle', async () => {
    const user = userEvent.setup()
    await i18next.changeLanguage('fa')
    renderProvider()

    await user.click(screen.getByRole('button', { name: 'LTR' }))

    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'fa')
  })

  it('restores a saved manual direction on reload', () => {
    document.cookie = 'dir=rtl; path=/'
    renderProvider()

    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })
})
