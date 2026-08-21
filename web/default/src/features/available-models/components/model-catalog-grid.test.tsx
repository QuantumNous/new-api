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
import { beforeAll, describe, expect, mock, test } from 'bun:test'
import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { PricingModel } from '@/features/pricing/types'
import type { ModelAccessModel } from '../types'

// The cards navigate with TanStack `Link`, which needs a live router context.
// A plain anchor stands in for it here; the actual link targets are asserted
// against `getModelPlaygroundLink` / `getModelQuickstartLink` in
// `model-catalog-actions.test.ts`, where no module mocking is involved.
mock.module('@tanstack/react-router', () => ({
  Link: ({
    to: _to,
    params: _params,
    search: _search,
    ...props
  }: {
    to?: string
    params?: Record<string, string>
    search?: Record<string, string>
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

const {
  ModelCatalogGrid,
  getEffectiveVisibleCatalogCount,
  getNextVisibleCatalogCount,
  MODEL_CATALOG_PAGE_SIZE,
} = await import('./model-catalog-grid')

const testI18n = createInstance()

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

function buildModel(
  overrides: Partial<ModelAccessModel> = {}
): ModelAccessModel {
  return {
    id: 'gpt-4o-mini',
    allowlist_match_key: 'gpt-4o-mini',
    vendor: { id: 1, name: 'OpenAI' },
    supported_endpoint_types: ['openai'],
    availability_status: 'available',
    ...overrides,
  }
}

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

function renderGrid(options: {
  models: ModelAccessModel[]
  pricing?: PricingModel[]
  modelRatios?: Readonly<Record<string, number>>
  defaultRatio?: number | null
  scopeIsEmpty?: boolean
}) {
  const priceIndex = new Map(
    (options.pricing ?? []).map((row) => [row.model_name, row])
  )

  return renderToStaticMarkup(
    <I18nextProvider i18n={testI18n}>
      <ModelCatalogGrid
        defaultRatio={options.defaultRatio ?? null}
        modelRatios={options.modelRatios ?? {}}
        models={options.models}
        priceIndex={priceIndex}
        scopeIsEmpty={options.scopeIsEmpty ?? false}
        onClearFilters={() => {}}
      />
    </I18nextProvider>
  )
}

describe('ModelCatalogGrid', () => {
  test('offers the quick start action on every card', () => {
    const html = renderGrid({ models: [buildModel()] })

    expect(html).toContain('Quick start')
  })

  // Quick start explains how to call a model from your own code, which is the
  // only route that fits embeddings, rerank and TTS — so it stays offered for
  // model families the Playground could never run.
  test('offers quick start for a model the Playground cannot call', () => {
    const html = renderGrid({
      models: [
        buildModel({
          id: 'text-embedding-3-small',
          supported_endpoint_types: ['embeddings'],
        }),
      ],
    })

    expect(html).toContain('Quick start')
  })

  test('offers quick start for a model upstreams dropped', () => {
    const html = renderGrid({
      models: [buildModel({ availability_status: 'official_unsupported' })],
    })

    expect(html).toContain('Quick start')
  })

  test('renders input and output unit prices from the pricing row', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [buildPricingModel()],
    })

    expect(html).toContain('Per 1M tokens')
    expect(html).toContain('$0.15')
    expect(html).toContain('$0.6')
  })

  // The ratio itself is an internal billing concept and is never shown; only
  // its effect on the displayed price reaches the user.
  test('scales displayed prices by an exclusive model ratio without naming it', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [buildPricingModel()],
      modelRatios: { 'gpt-4o-mini': 2 },
      defaultRatio: 1,
    })

    expect(html).toContain('$0.3')
    expect(html).not.toContain('Exclusive ratio')
    expect(html).not.toContain('×')
  })

  // The saving only lands if the user can see what it is measured against, so
  // the official rate is struck through beside ours.
  test('strikes through the official rate beside the discounted price', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [buildPricingModel()],
      defaultRatio: 0.5,
    })

    // `<s class=` rather than `<s`, which also matches the card's `<svg>`.
    expect(html).toContain('<s class=')
    expect(html).toContain('$0.15')
    expect(html).toContain('$0.075')
    expect(html).toContain('Save 50%')
  })

  // Striking through a price identical to ours would fake a discount that the
  // user is not actually getting.
  test('shows no official rate when the model is priced at list', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [buildPricingModel()],
      defaultRatio: 1,
    })

    expect(html).toContain('$0.15')
    expect(html).not.toContain('<s class=')
    expect(html).not.toContain('Save')
  })

  test('strikes through the official rate for a per-request model', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [buildPricingModel({ quota_type: 1, model_price: 0.04 })],
      defaultRatio: 0.5,
    })

    expect(html).toContain('Per request')
    expect(html).toContain('<s class=')
    expect(html).toContain('$0.04')
    expect(html).toContain('$0.02')
    expect(html).toContain('Save 50%')
  })

  test('renders no price panel when the model has no pricing row', () => {
    const html = renderGrid({ models: [buildModel()] })

    expect(html).not.toContain('Per 1M tokens')
    expect(html).not.toContain('Per request')
  })

  test('names dynamic billing instead of inventing a unit price', () => {
    const html = renderGrid({
      models: [buildModel()],
      pricing: [
        buildPricingModel({
          billing_mode: 'tiered_expr',
          billing_expr: 'inputPrice = 1',
        }),
      ],
    })

    expect(html).toContain('Dynamic pricing')
    expect(html).not.toContain('Per 1M tokens')
  })

  // The category badge already says "Video"; repeating it as an endpoint badge
  // read as a duplicate, and calling the endpoint "not specified" when one was
  // in fact declared read as missing data.
  test('does not repeat the category as an endpoint badge', () => {
    const html = renderGrid({
      models: [
        buildModel({ id: 'seedance-2.0', supported_endpoint_types: ['video'] }),
      ],
    })

    expect(html.match(/>Video</g)).toHaveLength(1)
    expect(html).not.toContain('Endpoint not specified')
  })

  // Nearly every model speaks the OpenAI-compatible protocol, so the badge
  // spent a slot to say nothing.
  test('drops the generic OpenAI-compatible endpoint badge', () => {
    const html = renderGrid({
      models: [buildModel({ supported_endpoint_types: ['openai'] })],
    })

    expect(html).not.toContain('OpenAI Compatible')
    expect(html).not.toContain('Endpoint not specified')
    expect(html).toContain('Chat')
  })

  // Protocols that only some models speak still earn their badge.
  test('keeps a distinguishing endpoint badge beside the generic one', () => {
    const html = renderGrid({
      models: [
        buildModel({ supported_endpoint_types: ['openai', 'anthropic'] }),
      ],
    })

    expect(html).not.toContain('OpenAI Compatible')
    expect(html).toContain('Anthropic Compatible')
  })

  test('flags a genuinely untagged model as endpoint-unspecified', () => {
    const html = renderGrid({
      models: [buildModel({ supported_endpoint_types: [] })],
    })

    expect(html).toContain('Endpoint not specified')
  })

  test('labels the model category alongside its endpoints', () => {
    const html = renderGrid({
      models: [
        buildModel({
          id: 'gpt-image-2',
          supported_endpoint_types: ['image-generation'],
        }),
      ],
    })

    expect(html).toContain('Image')
  })

  test('distinguishes filter misses from a truly empty scope', () => {
    const filtered = renderGrid({ models: [] })
    const emptyScope = renderGrid({ models: [], scopeIsEmpty: true })

    expect(filtered).toContain('No models match the selected filters')
    expect(emptyScope).toContain('No available models')
  })

  test('renders only the first page and offers incremental expansion', () => {
    const models = Array.from({ length: MODEL_CATALOG_PAGE_SIZE + 1 }, (_, i) =>
      buildModel({ id: `model-${i + 1}` })
    )

    const html = renderGrid({ models })

    expect(html).toContain(`model-${MODEL_CATALOG_PAGE_SIZE}`)
    expect(html).not.toContain(`model-${MODEL_CATALOG_PAGE_SIZE + 1}`)
    expect(html).toContain('>More</button>')
  })

  test('resets effective pagination when the model dataset changes', () => {
    const previousModels: ModelAccessModel[] = []
    const nextModels: ModelAccessModel[] = []
    const pagination = {
      models: previousModels,
      scopeIsEmpty: false,
      visibleCount: 96,
    }

    expect(
      getEffectiveVisibleCatalogCount(pagination, previousModels, false)
    ).toBe(96)
    expect(getEffectiveVisibleCatalogCount(pagination, nextModels, false)).toBe(
      MODEL_CATALOG_PAGE_SIZE
    )
    expect(
      getEffectiveVisibleCatalogCount(pagination, previousModels, true)
    ).toBe(MODEL_CATALOG_PAGE_SIZE)
  })

  test('advances paging by one page, capped at the total', () => {
    expect(getNextVisibleCatalogCount(MODEL_CATALOG_PAGE_SIZE, 30)).toBe(30)
    expect(getNextVisibleCatalogCount(MODEL_CATALOG_PAGE_SIZE, 999)).toBe(
      MODEL_CATALOG_PAGE_SIZE * 2
    )
  })
})
