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
import { render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, expect, test } from 'vitest'

import { MODEL_PRICES, type ModelPrice } from '../../data/model-prices'
import { PriceTable } from '../price-table'

async function useLanguage(language: string) {
  i18next.addResourceBundle(language, 'translation', {})
  await i18next.changeLanguage(language)
}

// Explicit fixtures: 25% cheaper than official, 10% cheaper than OpenRouter,
// one model OpenRouter does not list and one HisarWeb sells above the official
// price.
const cheaper: ModelPrice = {
  model: 'test-cheaper',
  provider: 'Anthropic',
  official: { input: 2, output: 10 },
  openrouter: { input: 1.67, output: 8.33 },
  hisarweb: { input: 1.5, output: 7.5 },
}
const noOpenRouter: ModelPrice = {
  model: 'test-no-openrouter',
  provider: 'Google',
  official: { input: 1, output: 5 },
  openrouter: null,
  hisarweb: { input: 1, output: 5 },
}
const dearer: ModelPrice = {
  model: 'test-dearer',
  provider: 'OpenAI',
  official: { input: 0.2, output: 1.2 },
  openrouter: { input: 0.2, output: 1.2 },
  hisarweb: { input: 1, output: 6 },
}

function rowOf(model: string): HTMLElement {
  return screen.getByText(model).closest('tr') as HTMLElement
}

beforeEach(async () => {
  await useLanguage('tr')
})

afterEach(async () => {
  await useLanguage('en')
})

test('lists all 9 sold models, one row each', () => {
  render(<PriceTable />)

  const rows = within(screen.getByRole('table')).getAllByRole('row')
  // Two header rows, then one row per model.
  expect(rows).toHaveLength(2 + 9)
  expect(MODEL_PRICES).toHaveLength(9)
  for (const entry of MODEL_PRICES) {
    expect(screen.getByText(entry.model)).toBeInTheDocument()
  }
})

test('shows a dash for a source that does not list the model', () => {
  render(<PriceTable models={[noOpenRouter]} />)

  const cells = within(rowOf('test-no-openrouter')).getAllByRole('cell')
  // model, official in/out, OpenRouter in/out, HisarWeb in/out, two savings
  expect(cells).toHaveLength(9)
  expect(cells[3]).toHaveTextContent('—')
  expect(cells[4]).toHaveTextContent('—')
  // The saving against the missing source is a dash too, never a guess.
  expect(cells[8]).toHaveTextContent('—')
})

test('shows every source with its URL and measurement date', () => {
  render(<PriceTable models={[cheaper, noOpenRouter, dearer]} />)

  const sources = screen.getByRole('heading', { name: 'Kaynaklar' })
    .parentElement as HTMLElement
  const links = within(sources).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    'https://platform.claude.com/docs/en/about-claude/pricing',
    'https://developers.openai.com/api/docs/pricing',
    'https://ai.google.dev/gemini-api/docs/pricing',
    'https://openrouter.ai/api/v1/models',
    'https://api.hisarweb.be/api/pricing',
  ])
  expect(within(sources).getAllByText(/2026-10-27/)).toHaveLength(5)
})

test('computes the saving against the official price and against OpenRouter', () => {
  render(<PriceTable models={[cheaper]} />)

  const cells = within(rowOf('test-cheaper')).getAllByRole('cell')
  // (2 + 10 - 1.5 - 7.5) / 12 = 25%
  expect(cells[7]).toHaveTextContent('%25')
  // (1.67 + 8.33 - 9) / 10 = 10%
  expect(cells[8]).toHaveTextContent('%10')
})

test('highlights the saving columns as the best price', () => {
  render(<PriceTable models={[cheaper, dearer]} />)

  const head = screen.getByText('En iyi fiyat').closest('th') as HTMLElement
  expect(head).toHaveTextContent('Tasarruf (HisarWeb AI)')
  expect(head).toHaveClass('hwp-best')

  const cells = within(rowOf('test-cheaper')).getAllByRole('cell')
  // Both saving cells carry the band; only the first opens it with an edge.
  expect(cells[7]).toHaveClass('hwp-best', 'hwp-best-edge')
  expect(cells[8]).toHaveClass('hwp-best')
  expect(cells[8]).not.toHaveClass('hwp-best-edge')
  expect(within(cells[7]).getByTestId('hw-saving-pill')).toHaveTextContent(
    '%25 tasarruf'
  )

  // No saving stays a plain warning, never a pill.
  const dearCells = within(rowOf('test-dearer')).getAllByRole('cell')
  expect(dearCells[7]).toHaveClass('hwp-best')
  expect(within(dearCells[7]).queryByTestId('hw-saving-pill')).toBeNull()
})

test('converts the dollar price into lira with the measured rate', () => {
  render(<PriceTable models={[cheaper]} tryPerUsd={50} />)

  const cells = within(rowOf('test-cheaper')).getAllByRole('cell')
  // HisarWeb input: 1.5 USD x 50 = 75 TRY
  expect(cells[5]).toHaveTextContent('$1,50')
  expect(cells[5]).toHaveTextContent('₺75,00')
})

test('says there is no saving when HisarWeb costs more than the reference', () => {
  render(<PriceTable models={[dearer]} />)

  const cells = within(rowOf('test-dearer')).getAllByRole('cell')
  expect(cells[7]).toHaveTextContent('Tasarruf yok')
  // 7 versus 1.4 is five times the price, 400% more.
  expect(cells[7]).toHaveTextContent('%400 daha pahalı')
  expect(cells[8]).toHaveTextContent('Tasarruf yok')
})

test('keeps the table inside its own horizontally scrollable wrapper', () => {
  render(<PriceTable models={[cheaper]} />)

  const wrapper = screen.getByRole('region', {
    name: /1M token/,
  })
  expect(wrapper).toContainElement(screen.getByRole('table'))
  expect(wrapper).toHaveClass('overflow-x-auto', 'max-w-full')
})

test('on a 390px phone shows one card per model with the HisarWeb price and saving first', async () => {
  const width = window.innerWidth
  window.innerWidth = 390
  try {
    render(<PriceTable models={[cheaper, noOpenRouter, dearer]} />)

    const cards = await screen.findAllByTestId('hw-price-card')
    expect(cards).toHaveLength(3)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    const card = within(cards[0])
    const pill = card.getByTestId('hw-saving-pill')
    expect(pill).toHaveTextContent('%25 tasarruf')
    const hisarweb = card.getByText('$1,50')
    // The saving pill comes before the price, so it is the first thing seen.
    expect(
      pill.compareDocumentPosition(hisarweb) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // The official price sits next to it, struck through.
    expect(card.getByText('$2,00').closest('s')).not.toBeNull()
    // OpenRouter is one secondary line with its own saving.
    const openrouter = card.getByTestId('hw-price-card-openrouter')
    expect(openrouter).toHaveTextContent('$1,67')
    expect(openrouter).toHaveTextContent('%10')

    // A model OpenRouter does not list shows a dash on that line.
    expect(
      within(cards[1]).getByTestId('hw-price-card-openrouter')
    ).toHaveTextContent('—')

    // Selling above the official price is a warning, never a pill.
    const dear = within(cards[2])
    expect(dear.queryByTestId('hw-saving-pill')).toBeNull()
    expect(dear.getAllByText(/Tasarruf yok/).length).toBeGreaterThan(0)
  } finally {
    window.innerWidth = width
  }
})

test('shows the explanation in English when the interface language is English', async () => {
  await useLanguage('en')
  render(<PriceTable models={[cheaper]} />)

  expect(
    screen.getByRole('heading', { name: 'Model price table' })
  ).toBeInTheDocument()
  expect(screen.getByText(/“1M tokens” means one million tokens/)).toBeVisible()
})
