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
import { fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { TokenExplainer } from '../components/token-explainer'
import { USAGE_SOURCE_URL } from '../lib/usage-calculator'

const trI18n = createInstance()
await trI18n.init({
  lng: 'tr',
  resources: { tr: { translation: {} } },
  initAsync: false,
})

function renderExplainer() {
  return render(
    <I18nextProvider i18n={trI18n}>
      <TokenExplainer locale='tr-TR' />
    </I18nextProvider>
  )
}

const HOURS_RESULT = /^Yaklaşık \S+ ile \S+ saat aktif kodlama$/

describe('TokenExplainer', () => {
  it('explains tokens, input and output in plain Turkish', () => {
    renderExplainer()
    expect(screen.getByText('Token nedir?')).toBeInTheDocument()
    expect(screen.getByText(/750\.000 kelime/)).toBeInTheDocument()
    expect(screen.getByText('Girdi ve çıktı')).toBeInTheDocument()
    expect(
      screen.getByText('Kodlama araçları neden çok girdi harcar?')
    ).toBeInTheDocument()
  })

  it('puts the calculator heading directly under the page title', () => {
    renderExplainer()
    // axe heading-order: an h3 straight after the page h1 skips a level.
    expect(
      screen.getByRole('heading', { level: 2, name: 'Bütçem ne kadar yeter?' })
    ).toBeInTheDocument()
  })

  it('shows hours and projects for the chosen budget, with the assumption and its source', () => {
    renderExplainer()
    expect(screen.getByText(HOURS_RESULT)).toBeInTheDocument()
    expect(screen.getByText(/küçük proje/)).toBeInTheDocument()
    expect(screen.getByText(/Yaklaşık, varsayım:/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Anthropic, maliyet rehberi/ })
    ).toHaveAttribute('href', USAGE_SOURCE_URL)
  })

  it('recalculates when another budget or model is chosen', () => {
    renderExplainer()
    const before = screen.getByText(HOURS_RESULT).textContent
    fireEvent.click(screen.getByRole('button', { name: /2\.500/ }))
    const afterBudget = screen.getByText(HOURS_RESULT).textContent
    expect(afterBudget).not.toBe(before)
    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'claude-haiku-5-5' },
    })
    expect(screen.getByText(HOURS_RESULT).textContent).not.toBe(afterBudget)
  })
})
