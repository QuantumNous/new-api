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
import { describe, expect, test } from 'bun:test'

import i18n from 'i18next'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { initReactI18next } from 'react-i18next'

import type { PricingModel } from '../src/features/pricing/types'

globalThis.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
} as Storage

const { useSystemConfigStore } =
  await import('../src/stores/system-config-store')
const { ModelCard } =
  await import('../src/features/pricing/components/model-card')
const { formatUsdUnitPrice } = await import('../src/features/pricing/lib/price')
const { QUOTA_TYPE_VALUES } = await import('../src/features/pricing/constants')
const { getImageSummaryPriceEntries } =
  await import('../src/features/pricing/lib/model-helpers')
const { DEFAULT_SYSTEM_NAME, DEFAULT_LOGO } =
  await import('../src/lib/constants')

if (!i18n.isInitialized) {
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {},
    interpolation: { escapeValue: false },
  })
}

function setCnyCurrency(usdExchangeRate: number) {
  useSystemConfigStore.setState({
    config: {
      systemName: DEFAULT_SYSTEM_NAME,
      logo: DEFAULT_LOGO,
      currency: {
        displayInCurrency: true,
        quotaDisplayType: 'CNY',
        quotaPerUnit: 500000,
        usdExchangeRate,
        customCurrencySymbol: '¤',
        customCurrencyExchangeRate: 1,
      },
    },
    loading: false,
    loadedLogoUrl: DEFAULT_LOGO,
  })
}

describe('pricing display', () => {
  test('formats USD unit prices with the configured CNY exchange rate', () => {
    setCnyCurrency(7)

    expect(formatUsdUnitPrice(0.04)).toBe('¥0.28')
  })

  test('uses image price_matrix medium tiers for card summaries', () => {
    setCnyCurrency(1)

    const imagePrices = {
      price_1k: 0.365,
      price_2k: 0.584,
      price_4k: 1.095,
      price_matrix: {
        '1k_low': 0.04,
        '1k_medium': 0.05,
        '1k_high': 0.08,
        '2k_low': 0.06,
        '2k_medium': 0.08,
        '2k_high': 0.12,
        '4k_low': 0.1,
        '4k_medium': 0.15,
        '4k_high': 0.25,
        default: 0.06,
      },
    }
    const model = {
      id: 1,
      model_name: 'gpt-image-2',
      quota_type: QUOTA_TYPE_VALUES.REQUEST,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      group_ratio: { default: 1 },
      image_billing_mode: 'per_size',
      image_per_size_prices: imagePrices,
    } satisfies PricingModel

    const html = renderToStaticMarkup(
      <ModelCard
        model={model}
        onClick={() => undefined}
        priceRate={1}
        usdExchangeRate={1}
        tokenUnit='K'
        showRechargePrice={false}
      />
    )

    expect(
      getImageSummaryPriceEntries(imagePrices).map((entry) => entry.value)
    ).toEqual([0.05, 0.08, 0.15])
    expect(html).toContain('¥0.05')
    expect(html).toContain('¥0.08')
    expect(html).toContain('¥0.15')
    expect(html).not.toContain('¥0.365')
  })

  test('formats video per-second matrix prices as CNY on cards', () => {
    setCnyCurrency(7)

    const model = {
      id: 2,
      model_name: 'video-test',
      quota_type: QUOTA_TYPE_VALUES.REQUEST,
      model_ratio: 0,
      completion_ratio: 0,
      enable_groups: ['default'],
      group_ratio: { default: 1 },
      video_billing_mode: 'per_second',
      video_per_second_prices: {
        price_matrix: {
          '1080p': 0.12,
        },
      },
    } satisfies PricingModel

    const html = renderToStaticMarkup(
      <ModelCard
        model={model}
        onClick={() => undefined}
        priceRate={1}
        usdExchangeRate={7}
        tokenUnit='K'
        showRechargePrice={false}
      />
    )

    expect(html).toContain('¥0.84')
    expect(html).not.toContain('$0.12')
  })
})
