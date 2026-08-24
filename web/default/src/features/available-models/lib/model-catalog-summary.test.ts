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
import type { ModelAccessModel } from '../types'
import type { CatalogPrice } from './model-catalog-price'
import { getModelCatalogSummary } from './model-catalog-summary'

function buildModel(
  overrides: Partial<ModelAccessModel> = {}
): ModelAccessModel {
  return {
    id: 'gpt-4o-mini',
    allowlist_match_key: 'gpt-4o-mini',
    vendor: null,
    supported_endpoint_types: ['openai'],
    availability_status: 'available',
    ...overrides,
  }
}

function tokenPrice(inputUSD: number, outputUSD: number | null): CatalogPrice {
  return { kind: 'token', inputUSD, outputUSD }
}

describe('getModelCatalogSummary', () => {
  test('counts models and breaks them down by category', () => {
    const summary = getModelCatalogSummary([
      { model: buildModel({ id: 'gpt-4o' }), price: { kind: 'none' } },
      { model: buildModel({ id: 'gpt-4o-mini' }), price: { kind: 'none' } },
      {
        model: buildModel({
          id: 'gpt-image-2',
          supported_endpoint_types: ['image-generation'],
        }),
        price: { kind: 'none' },
      },
    ])

    expect(summary.total).toBe(3)
    expect(summary.breakdown).toEqual([
      { category: 'chat', count: 2 },
      { category: 'image', count: 1 },
    ])
  })

  test('reports an empty summary for no models', () => {
    const summary = getModelCatalogSummary([])

    expect(summary.total).toBe(0)
    expect(summary.breakdown).toEqual([])
    expect(summary.categoryPrices).toEqual([])
  })

  test('reports the lowest token input price within a category', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({
          id: 'img-a',
          supported_endpoint_types: ['image-generation'],
        }),
        price: tokenPrice(5, 30),
      },
      {
        model: buildModel({
          id: 'img-b',
          supported_endpoint_types: ['image-generation'],
        }),
        price: tokenPrice(2, 12),
      },
    ])

    expect(summary.categoryPrices).toEqual([
      {
        category: 'image',
        count: 2,
        lowest: { unit: 'token', amountUSD: 2 },
        mixedBilling: false,
      },
    ])
  })

  test('falls back to the per-request price when a category has no token pricing', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({ id: 'vid-a', supported_endpoint_types: ['video'] }),
        price: { kind: 'request', priceUSD: 3 },
      },
      {
        model: buildModel({ id: 'vid-b', supported_endpoint_types: ['video'] }),
        price: { kind: 'request', priceUSD: 1 },
      },
    ])

    expect(summary.categoryPrices[0].lowest).toEqual({
      unit: 'request',
      amountUSD: 1,
    })
  })

  // Mixing a "$1 per request" model into a "$0.78 per 1M tokens" figure would
  // compare two different units. Token pricing wins so the number keeps one
  // meaning, and `mixedBilling` lets the UI say the rest are billed otherwise.
  test('prefers token pricing and flags a category that also bills per request', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({ id: 'vid-a', supported_endpoint_types: ['video'] }),
        price: tokenPrice(0.782, 3.876),
      },
      {
        model: buildModel({ id: 'vid-b', supported_endpoint_types: ['video'] }),
        price: { kind: 'request', priceUSD: 1 },
      },
    ])

    expect(summary.categoryPrices[0].lowest).toEqual({
      unit: 'token',
      amountUSD: 0.782,
    })
    expect(summary.categoryPrices[0].mixedBilling).toBe(true)
  })

  test('does not flag mixed billing when every model bills the same way', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({ id: 'vid-a', supported_endpoint_types: ['video'] }),
        price: tokenPrice(0.782, 3.876),
      },
    ])

    expect(summary.categoryPrices[0].mixedBilling).toBe(false)
  })

  test('reports no price for a category whose models are all unpriced', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({ id: 'vid-a', supported_endpoint_types: ['video'] }),
        price: { kind: 'none' },
      },
      {
        model: buildModel({ id: 'vid-b', supported_endpoint_types: ['video'] }),
        price: { kind: 'dynamic' },
      },
    ])

    expect(summary.categoryPrices).toEqual([])
  })

  test('keeps a free model rather than treating zero as missing', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({ id: 'free-model' }),
        price: tokenPrice(0, 0),
      },
    ])

    expect(summary.categoryPrices[0].lowest).toEqual({
      unit: 'token',
      amountUSD: 0,
    })
  })

  test('orders categories by the canonical catalog order', () => {
    const summary = getModelCatalogSummary([
      {
        model: buildModel({
          id: 'sonilo-video-to-music',
          supported_endpoint_types: ['video-to-music'],
        }),
        price: tokenPrice(4, 4),
      },
      {
        model: buildModel({ id: 'vid', supported_endpoint_types: ['video'] }),
        price: tokenPrice(3, 3),
      },
      {
        model: buildModel({ id: 'gpt-4o' }),
        price: tokenPrice(1, 2),
      },
    ])

    expect(summary.categoryPrices.map((item) => item.category)).toEqual([
      'chat',
      'video',
      'audio',
    ])
  })
})
