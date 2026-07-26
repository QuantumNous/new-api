import { computed, ref } from 'vue'
import { refDebounced, useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { Currency, MarketListing, Merchant } from '@/types/console'
import { USD_TO_CNY } from '@/constants/console'
import { useToast } from '@/composables/useToast'

export type MarketViewMode = 'grid' | 'list'
export type MarketSide = 'buy' | 'sell' | 'mine'
export type MarketSort = 'default' | 'price' | 'qc' | 'availability' | 'rating'

export interface MarketCatalog {
  listings: MarketListing[]
  merchants: Merchant[]
  channels: string[]
  vendors: string[] // distinct AI vendors derived from listing.modelVendors
  meta: { merchantCount: number; channelCount: number; avgAvailability: number }
}

export interface MerchantGroup {
  merchant: Merchant
  listings: MarketListing[]
}

export function useMarketplace() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(true)
  const catalog = ref<MarketCatalog | null>(null)

  const side = ref<MarketSide>('buy')
  const keyword = ref('')
  // Debounced mirror driving the filter, so typing doesn't re-run the full
  // catalog scan on every keystroke.
  const keywordFiltered = refDebounced(keyword, 150)
  const vendor = ref('') // AI vendor name ('' = all)
  const source = ref('') // listing source/channel ('' = all)
  const types = ref<string[]>([]) // multi-select; [] = all
  const sort = ref<MarketSort>('default')
  // Merchant scale filter: exact match ('' = all).
  const scale = ref('') // '' | 'platform' | 'vendor' | 'workshop' | 'studio' | 'empire'
  const currency = useLocalStorage<Currency>('ren2hub_market_currency', 'CNY')
  const view = useLocalStorage<MarketViewMode>('ren2hub_market_view', 'list')

  async function load() {
    loading.value = true
    try {
      catalog.value = await api.get<MarketCatalog>('/api/market/catalog')
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  const merchantById = computed(() => {
    const map = new Map<number, Merchant>()
    for (const m of catalog.value?.merchants ?? []) map.set(m.id, m)
    return map
  })

  const filtered = computed(() => {
    const all = catalog.value?.listings ?? []
    const kw = keywordFiltered.value.trim().toLowerCase()
    const list = all.filter((l) => {
      const merchant = merchantById.value.get(l.merchantId)
      if (kw) {
        const hay =
          `${l.title} ${l.summary} ${merchant?.name ?? ''} ${l.supportedModels.join(' ')}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      if (vendor.value && !l.modelVendors.includes(vendor.value)) return false
      if (source.value && l.source !== source.value) return false
      if (types.value.length > 0 && !types.value.includes(l.type)) return false
      if (scale.value && merchant?.scale !== scale.value) return false
      return true
    })
    if (sort.value === 'default') return list
    const sorted = [...list]
    switch (sort.value) {
      case 'price':
        sorted.sort((a, b) => a.priceUSD - b.priceUSD)
        break
      case 'qc':
        sorted.sort((a, b) => b.qcScore - a.qcScore)
        break
      case 'availability':
        sorted.sort((a, b) => b.availability - a.availability)
        break
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating)
        break
    }
    return sorted
  })

  /** Group filtered listings by merchant, ordered by catalog merchant order. */
  const merchantGroups = computed<MerchantGroup[]>(() => {
    const byMerchant = new Map<number, MarketListing[]>()
    for (const l of filtered.value) {
      const bucket = byMerchant.get(l.merchantId)
      if (bucket) bucket.push(l)
      else byMerchant.set(l.merchantId, [l])
    }
    return (catalog.value?.merchants ?? [])
      .filter((m) => byMerchant.has(m.id))
      .map((m) => ({ merchant: m, listings: byMerchant.get(m.id)! }))
  })

  const resultCount = computed(() => filtered.value.length)
  const hasResults = computed(() => resultCount.value > 0)

  // Toolbar stats come from server meta: full-catalog counts + overall health,
  // stable regardless of local filtering.
  const merchantCount = computed(() => catalog.value?.meta.merchantCount ?? 0)
  const availableChannelCount = computed(
    () => catalog.value?.meta.channelCount ?? 0
  )
  const avgAvailability = computed(
    () => catalog.value?.meta.avgAvailability ?? 0
  )

  const vendorOptions = computed(() => catalog.value?.vendors ?? [])
  const sourceOptions = computed(() =>
    [...new Set((catalog.value?.listings ?? []).map((l) => l.source))].sort()
  )

  /** Convert a USD base price into the active currency + symbol. */
  function formatPrice(usd: number): string {
    if (currency.value === 'USD') {
      return `$${usd.toFixed(usd < 1 ? 4 : 2)}`
    }
    const cny = usd * USD_TO_CNY
    return `¥${cny.toFixed(cny < 1 ? 3 : 2)}`
  }

  return {
    loading,
    catalog,
    side,
    keyword,
    vendor,
    source,
    types,
    sort,
    scale,
    currency,
    view,
    filtered,
    merchantGroups,
    merchantById,
    resultCount,
    hasResults,
    merchantCount,
    availableChannelCount,
    avgAvailability,
    vendorOptions,
    sourceOptions,
    formatPrice,
    load,
  }
}
