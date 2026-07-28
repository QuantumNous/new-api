import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import {
  useMarketplace,
  type MarketCatalog,
} from '@/composables/useMarketplace'
import i18n from '@/i18n'
import type { MarketListing, Merchant } from '@/types/console'

function merchant(
  id: number,
  name: string,
  scale: Merchant['scale']
): Merchant {
  return {
    id,
    name,
    scale,
    comments: [],
    channelCount: 1,
    joinedAt: 1_700_000_000,
    verified: true,
  }
}

function listing(
  id: number,
  merchantId: number,
  overrides: Partial<MarketListing> = {}
): MarketListing {
  return {
    id,
    merchantId,
    title: `listing-${id}`,
    summary: '',
    source: 'OpenAI 官转',
    availability: 99,
    supportedModels: ['gpt-5'],
    qcScore: 90,
    tags: [],
    priceUSD: 1,
    type: 'chat',
    listedAt: 1_700_000_000,
    rating: 4.5,
    reviewCount: 10,
    status: 'active',
    modelVendors: ['OpenAI'],
    ...overrides,
  }
}

const catalog: MarketCatalog = {
  merchants: [
    merchant(1, 'Alpha Lab', 'studio'),
    merchant(2, 'Beta Works', 'workshop'),
  ],
  listings: [
    listing(11, 1, { title: 'GPT relay', priceUSD: 3 }),
    listing(12, 1, {
      title: 'Claude relay',
      priceUSD: 1,
      modelVendors: ['Claude'],
      type: 'image',
    }),
    listing(21, 2, {
      title: 'Gemini relay',
      priceUSD: 2,
      modelVendors: ['Gemini'],
    }),
  ],
  channels: ['OpenAI 官转'],
  vendors: ['OpenAI', 'Claude', 'Gemini'],
  meta: { merchantCount: 2, channelCount: 3, avgAvailability: 99 },
}

let wrapper: VueWrapper | null = null

function setupMarketplace() {
  let state: ReturnType<typeof useMarketplace> | null = null
  wrapper = mount(
    defineComponent({
      setup() {
        state = useMarketplace()
        return () => null
      },
    }),
    { global: { plugins: [i18n] } }
  )
  if (!state) throw new Error('expected marketplace state')
  const marketplace = state as ReturnType<typeof useMarketplace>
  marketplace.catalog.value = structuredClone(catalog)
  return marketplace
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('useMarketplace filtering', () => {
  it('filters by vendor and type without mutating catalog order', async () => {
    const market = setupMarketplace()
    expect(market.filtered.value).toHaveLength(3)

    market.vendor.value = 'Claude'
    await nextTick()
    expect(market.filtered.value.map((l) => l.id)).toEqual([12])

    market.vendor.value = ''
    market.types.value = ['chat']
    await nextTick()
    expect(market.filtered.value.map((l) => l.id)).toEqual([11, 21])
  })

  it('sorts by price ascending while default keeps catalog order', async () => {
    const market = setupMarketplace()
    market.sort.value = 'price'
    await nextTick()
    expect(market.filtered.value.map((l) => l.priceUSD)).toEqual([1, 2, 3])
  })

  it('groups filtered listings under their merchants in catalog order', () => {
    const market = setupMarketplace()
    const groups = market.merchantGroups.value
    expect(groups.map((g) => g.merchant.name)).toEqual([
      'Alpha Lab',
      'Beta Works',
    ])
    expect(groups[0].listings.map((l) => l.id)).toEqual([11, 12])
  })

  it('applies the keyword only after the debounce window', async () => {
    const market = setupMarketplace()
    market.keyword.value = 'gemini'
    await nextTick()
    // Immediate read still shows everything; the filter follows ~150ms later.
    expect(market.filtered.value).toHaveLength(3)
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    expect(market.filtered.value.map((l) => l.id)).toEqual([21])
  })

  it('formats prices for both currencies', () => {
    const market = setupMarketplace()
    market.currency.value = 'USD'
    expect(market.formatPrice(2)).toBe('$2.00')
    expect(market.formatPrice(0.5)).toBe('$0.5000')
    market.currency.value = 'CNY'
    expect(market.formatPrice(1)).toMatch(/^¥\d/)
  })
})
