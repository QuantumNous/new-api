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
import type { PricingModel } from '@/features/pricing/types'
import { buildCatalogPriceIndex, resolveCatalogPrice } from './model-catalog-price'

function buildPricingModel(
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: 1,
    model_name: 'gpt-4o-mini',
    quota_type: 0,
    model_ratio: 0.075,
    completion_ratio: 4,
    enable_groups: ['default'],
    ...overrides,
  }
}

describe('resolveCatalogPrice', () => {
  test('reports no price when the model has no pricing row', () => {
    expect(resolveCatalogPrice(undefined, { ratio: 1 })).toEqual({
      kind: 'none',
    })
  })

  // model_ratio 0.075 × 2 = $0.15 per 1M input tokens at ratio 1.
  test('derives input and output prices per 1M tokens', () => {
    const price = resolveCatalogPrice(buildPricingModel(), { ratio: 1 })

    expect(price.kind).toBe('token')
    if (price.kind !== 'token') throw new Error('expected token pricing')
    expect(price.inputUSD).toBeCloseTo(0.15, 10)
    expect(price.outputUSD).toBeCloseTo(0.6, 10)
  })

  test('scales both prices by the applied ratio', () => {
    const price = resolveCatalogPrice(buildPricingModel(), { ratio: 0.5 })

    if (price.kind !== 'token') throw new Error('expected token pricing')
    expect(price.inputUSD).toBeCloseTo(0.075, 10)
    expect(price.outputUSD).toBeCloseTo(0.3, 10)
  })

  test('reports a per-request price for request-billed models', () => {
    const price = resolveCatalogPrice(
      buildPricingModel({ quota_type: 1, model_price: 0.04 }),
      { ratio: 2 }
    )

    expect(price).toEqual({ kind: 'request', priceUSD: 0.08 })
  })

  test('treats a request-billed model without a price as free', () => {
    const price = resolveCatalogPrice(
      buildPricingModel({ quota_type: 1 }),
      { ratio: 1 }
    )

    expect(price).toEqual({ kind: 'request', priceUSD: 0 })
  })

  // A tiered expression has no single number to show; inventing one would
  // misprice the model on the card.
  test('reports dynamic billing without inventing a number', () => {
    const price = resolveCatalogPrice(
      buildPricingModel({
        billing_mode: 'tiered_expr',
        billing_expr: 'inputPrice = 1',
      }),
      { ratio: 1 }
    )

    expect(price).toEqual({ kind: 'dynamic' })
  })

  test('ignores a tiered billing mode that carries no expression', () => {
    const price = resolveCatalogPrice(
      buildPricingModel({ billing_mode: 'tiered_expr' }),
      { ratio: 1 }
    )

    expect(price.kind).toBe('token')
  })

  test('omits the output price when the completion ratio is missing', () => {
    const price = resolveCatalogPrice(
      buildPricingModel({ completion_ratio: 0 }),
      { ratio: 1 }
    )

    if (price.kind !== 'token') throw new Error('expected token pricing')
    expect(price.inputUSD).toBeCloseTo(0.15, 10)
    expect(price.outputUSD).toBeNull()
  })

  test('reports no price when the model ratio is not a usable number', () => {
    expect(
      resolveCatalogPrice(
        buildPricingModel({ model_ratio: Number.NaN }),
        { ratio: 1 }
      )
    ).toEqual({ kind: 'none' })
  })
})

describe('buildCatalogPriceIndex', () => {
  test('indexes pricing rows by model name', () => {
    const rows = [
      buildPricingModel({ model_name: 'gpt-4o' }),
      buildPricingModel({ model_name: 'gpt-4o-mini' }),
    ]

    const index = buildCatalogPriceIndex(rows)

    expect(index.get('gpt-4o')?.model_name).toBe('gpt-4o')
    expect(index.get('gpt-4o-mini')?.model_name).toBe('gpt-4o-mini')
    expect(index.get('missing-model')).toBeUndefined()
  })

  test('returns an empty index for missing pricing data', () => {
    expect(buildCatalogPriceIndex(undefined).size).toBe(0)
  })

  test('keeps the first row when a model name is duplicated', () => {
    const index = buildCatalogPriceIndex([
      buildPricingModel({ model_name: 'gpt-4o', model_ratio: 1 }),
      buildPricingModel({ model_name: 'gpt-4o', model_ratio: 2 }),
    ])

    expect(index.get('gpt-4o')?.model_ratio).toBe(1)
  })
})

describe('resolveCatalogPriceRatio', () => {
  test('prefers an exclusive model ratio over the scope default', async () => {
    const { resolveCatalogPriceRatio } = await import('./model-catalog-price')

    expect(
      resolveCatalogPriceRatio({
        modelId: 'gpt-4o',
        modelRatios: { 'gpt-4o': 0.8 },
        defaultRatio: 2,
      })
    ).toBe(0.8)
  })

  test('falls back to the scope default ratio', async () => {
    const { resolveCatalogPriceRatio } = await import('./model-catalog-price')

    expect(
      resolveCatalogPriceRatio({
        modelId: 'gpt-4o',
        modelRatios: {},
        defaultRatio: 2,
      })
    ).toBe(2)
  })

  test('falls back to 1 when no ratio is configured', async () => {
    const { resolveCatalogPriceRatio } = await import('./model-catalog-price')

    expect(
      resolveCatalogPriceRatio({
        modelId: 'gpt-4o',
        modelRatios: {},
        defaultRatio: null,
      })
    ).toBe(1)
  })

  // An exclusive ratio of 0 means the model is free in this group; treating
  // that as "unset" would silently bill it at the group default instead.
  test('honours an exclusive ratio of zero', async () => {
    const { resolveCatalogPriceRatio } = await import('./model-catalog-price')

    expect(
      resolveCatalogPriceRatio({
        modelId: 'gpt-4o',
        modelRatios: { 'gpt-4o': 0 },
        defaultRatio: 2,
      })
    ).toBe(0)
  })
})
