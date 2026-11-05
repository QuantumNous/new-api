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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { PriceComparator } from '../components/price-comparator'
import type { HwPriceComparison } from '../types'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children?: React.ReactNode }) => (
    <main data-testid='public-layout'>{props.children}</main>
  ),
}))
vi.mock('@/components/layout/components/footer', () => ({
  Footer: () => <footer data-testid='site-footer' />,
}))

const trI18n = createInstance()
await trI18n.init({
  lng: 'tr',
  resources: { tr: { translation: {} } },
  initAsync: false,
})

const clients: QueryClient[] = []

const comparison: HwPriceComparison = {
  model: 'claude-opus-5-5',
  input_tokens: 1000000,
  output_tokens: 250000,
  official_cost_usd: '0.42',
  official_cost_try: '15.12',
  first_purchase_try: '7.56',
  repeat_purchase_try: '12.85',
  savings_first_try: '7.56',
  savings_repeat_try: '2.27',
  try_per_usd: '36',
  price_source: 'https://example.com/prices.json',
  price_fetched_at: '2026-10-19T08:30:00Z',
  fx_source: 'https://example.com/kur.xml',
  fx_date: '2026-10-19',
  stale: false,
  prices_include_kdv: true,
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <I18nextProvider i18n={trI18n}>
      <QueryClientProvider client={client}>
        <PriceComparator />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

async function submitTokens(input: string, output: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Aylık girdi token sayısı'), input)
  await user.type(screen.getByLabelText('Aylık çıktı token sayısı'), output)
  await user.click(screen.getByRole('button', { name: 'Karşılaştır' }))
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, message: '', data: comparison },
  })
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('price comparator page', () => {
  it('renders the Turkish form inside the public layout', () => {
    renderPage()

    expect(screen.getByTestId('public-layout')).toBeInTheDocument()
    expect(screen.getByLabelText('Model')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Aylık girdi token sayısı')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Karşılaştır' })
    ).toBeInTheDocument()
  })

  it('sends the entered monthly tokens to the compare endpoint and shows source and date', async () => {
    renderPage()

    await submitTokens('1000000', '250000')

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith('/api/hw/pricing/compare', {
        params: {
          model: 'claude-opus-5-5',
          input_tokens: 1000000,
          output_tokens: 250000,
        },
      })
    )

    expect(await screen.findByText('Fiyat kaynağı')).toBeInTheDocument()
    expect(
      screen.getByText('https://example.com/prices.json')
    ).toBeInTheDocument()
    expect(screen.getByText('Fiyat tarihi')).toBeInTheDocument()
    expect(
      screen.getAllByText(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}$/)
    ).toHaveLength(1)
    expect(screen.getByText('Kur kaynağı')).toBeInTheDocument()
    expect(screen.getByText('https://example.com/kur.xml')).toBeInTheDocument()
    expect(screen.getByText('Kur tarihi')).toBeInTheDocument()
    expect(screen.getByText('19.10.2026')).toBeInTheDocument()
    expect(screen.getByText('Resmî liste fiyatı (USD)')).toBeInTheDocument()
    expect(screen.getByText('Resmî liste fiyatı (TL)')).toBeInTheDocument()
    expect(
      screen.getByText(
        'HisarWeb AI fiyatı (ilk alışveriş, hoş geldin indirimiyle)'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('HisarWeb AI fiyatı (her alışverişte)')
    ).toBeInTheDocument()
  })

  it('warns when the price data is stale', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        message: '',
        data: { ...comparison, stale: true },
      },
    })
    renderPage()

    await submitTokens('1000000', '250000')

    expect(
      await screen.findByText('Fiyat verisi güncel olmayabilir')
    ).toBeInTheDocument()
  })

  it('rejects a fractional token count without calling the API', async () => {
    renderPage()

    await submitTokens('12,5', '250000')

    expect(api.get).not.toHaveBeenCalled()
    expect(screen.getAllByText(/Token sayısı 0 ile/).length).toBeGreaterThan(0)
  })

  it('explains a 404 as a model without price data', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } })
    )
    renderPage()

    await submitTokens('1000000', '250000')

    expect(
      await screen.findByText('Bu model satılmıyor veya fiyat verisi yok.')
    ).toBeInTheDocument()
  })

  it('never names an upstream supplier', async () => {
    renderPage()
    await submitTokens('1000000', '250000')
    await screen.findByText('Fiyat kaynağı')

    // The price table names OpenRouter on purpose, as a public price to compare
    // with. Everything outside that table, such as the comparison result, still
    // must not name it as a supplier.
    const page = document.body.cloneNode(true) as HTMLElement
    page.querySelector('[data-testid="hw-price-table"]')?.remove()
    const text = page.textContent?.toLowerCase() ?? ''
    expect(text).not.toContain('lumia')
    expect(text).not.toContain('openrouter')
    expect(document.body.textContent?.toLowerCase()).not.toContain('lumia')
  })
})
