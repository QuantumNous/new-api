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
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import { modelGuide } from '@/features/hw/data/model-guide'
import { api } from '@/lib/api'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import trLocale from '../../../i18n/locales/tr.json'
import { ModelDetailsContent } from '../components/model-details'
import type { PricingModel } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children?: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

function pricingModel(overrides: Partial<PricingModel> = {}): PricingModel {
  return {
    id: 1,
    model_name: 'gpt-4o',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 3,
    enable_groups: ['free', 'paid'],
    group_ratio: { free: 1, paid: 1 },
    supported_endpoint_types: ['openai'],
    ...overrides,
  }
}

const endpointMap = { openai: { path: '/v1/chat/completions', method: 'POST' } }

let queryClient: QueryClient
const originalStorage = useSystemConfigStore.persist.getOptions().storage

function renderDetails(model: PricingModel = pricingModel()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ModelDetailsContent
        model={model}
        groupRatio={{ free: 1, paid: 1 }}
        usableGroup={{
          free: { desc: '', ratio: 1 },
          paid: { desc: '', ratio: 1 },
        }}
        endpointMap={endpointMap}
        autoGroups={[]}
        priceRate={1}
        usdExchangeRate={1}
        tokenUnit='M'
      />
    </QueryClientProvider>
  )
}

async function useTurkish() {
  i18next.addResourceBundle('tr', 'translation', trLocale.translation, true)
  await i18next.changeLanguage('tr')
}

async function openApiTab() {
  await userEvent.click(screen.getByRole('tab', { name: /API/ }))
}

beforeEach(() => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { groups: [] } } })
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
})

afterEach(async () => {
  queryClient.clear()
  vi.restoreAllMocks()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.unstubAllGlobals()
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
  await i18next.changeLanguage('en')
})

describe('model details in plain language', () => {
  it('lets the tab titles wrap instead of clipping them on a phone', async () => {
    await useTurkish()
    renderDetails()
    for (const name of ['Genel Bakış', 'Performans']) {
      const label = await screen.findByText(name)
      expect(label.className).not.toMatch(/truncate|line-clamp/)
      expect(label.closest('button')?.className).toMatch(/whitespace-normal/)
    }
  })

  it('shows what a model is good for at the top when the database has no description', async () => {
    await useTurkish()
    renderDetails(pricingModel({ model_name: 'claude-sonnet-5-5' }))
    const text = modelGuide('claude-sonnet-5-5')?.description.tr ?? ''
    expect(text).not.toBe('')
    expect(await screen.findByText(text)).toBeTruthy()
  })

  it('prefers the description from the database over the guide text', async () => {
    renderDetails(
      pricingModel({
        model_name: 'claude-sonnet-5-5',
        description: 'Written by the operator.',
      })
    )
    expect(await screen.findByText('Written by the operator.')).toBeTruthy()
    const guideEn = modelGuide('claude-sonnet-5-5')?.description.en ?? ''
    expect(guideEn).not.toBe('')
    expect(screen.queryByText(guideEn)).toBeNull()
  })

  it('shows the pay-as-you-go badge in Turkish', async () => {
    await useTurkish()
    renderDetails()
    expect(
      (await screen.findAllByText('Kullandıkça öde')).length
    ).toBeGreaterThan(0)
  })

  it('does not show Free or Paid group labels in the overview', async () => {
    await useTurkish()
    const { container } = renderDetails()
    await screen.findAllByText('Kullandıkça öde')
    expect(container.textContent).not.toMatch(/Ücretsiz|Ücretli/)
    expect(container.textContent).not.toMatch(/\b(Free|Paid)\b/)
  })

  it('explains a technical label with a hint reachable by assistive tech', () => {
    renderDetails()
    const label = screen.getByText('Text you send')
    expect(label.closest('[aria-description]')).toHaveAttribute(
      'aria-description',
      expect.stringContaining('1 million tokens is about 750,000 words')
    )
  })

  it('has a "How do I connect" section with one key name in the examples', async () => {
    renderDetails()
    await openApiTab()
    expect(await screen.findByText('How do I connect')).toBeInTheDocument()
    const text = document.body.textContent ?? ''
    expect(text).toContain('YOUR_API_KEY')
    expect(text).not.toContain('NEW_API_KEY')
    expect(text).not.toContain('<YOUR_API_KEY>')
  })

  it('shows "Nasıl bağlanırım" in Turkish', async () => {
    await useTurkish()
    renderDetails()
    await openApiTab()
    expect(await screen.findByText('Nasıl bağlanırım')).toBeInTheDocument()
  })

  it('writes rate limits as sentences', async () => {
    renderDetails()
    await openApiTab()
    await waitFor(() =>
      expect(
        screen.getAllByText(/^Up to .+ requests per minute$/).length
      ).toBeGreaterThan(0)
    )
    expect(screen.queryByText('RPM')).not.toBeInTheDocument()
  })
})
