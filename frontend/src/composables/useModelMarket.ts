import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { MarketModel } from '@/types/console'
import { vendorMeta } from '@/constants/console'
import { useToast } from '@/composables/useToast'

// Prefixed to stay distinct from useMarketplace's same-named exports — the two
// composables cover different catalogs (models vs merchant listings).
export type ModelMarketViewMode = 'grid' | 'list'
export type ModelMarketSort = 'default' | 'latency' | 'tps' | 'price' | 'health'

export interface ModelMarketCatalog {
  models: MarketModel[]
  channels: string[]
  vendors: string[]
}

export interface VendorGroup {
  vendor: string
  tagline: string
  models: MarketModel[]
  channelCount: number
  healthy: number // health >= 95
  degraded: number // 80..94
  down: number // < 80
}

/**
 * Sort key for the price ordering. `input` ($/1M tokens) and `per_call`
 * ($/call) are different units and must not be compared directly, so per-call
 * models are grouped after all token-priced ones (bucket 0 vs 1) and only
 * compared within their own unit.
 */
function priceKey(m: MarketModel): [number, number] {
  const p = m.price
  const tokenPrice = p.input ?? p.tiers?.[0]?.input
  if (tokenPrice != null) return [0, tokenPrice]
  if (p.per_call != null) return [1, p.per_call]
  return [2, Number.MAX_SAFE_INTEGER]
}

/** Compare two [bucket, price] keys: bucket first, then price within bucket. */
function comparePrice(a: MarketModel, b: MarketModel): number {
  const [ba, pa] = priceKey(a)
  const [bb, pb] = priceKey(b)
  return ba !== bb ? ba - bb : pa - pb
}

export function useModelMarket() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(true)
  const catalog = ref<ModelMarketCatalog | null>(null)

  const keyword = ref('')
  const channel = ref('')
  const vendor = ref('')
  const type = ref('')
  const sort = ref<ModelMarketSort>('default')
  const view = useLocalStorage<ModelMarketViewMode>(
    'ren2hub_models_view',
    'grid'
  )

  async function load() {
    loading.value = true
    try {
      catalog.value = await api.get<ModelMarketCatalog>('/api/models/market')
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  const filtered = computed(() => {
    const all = catalog.value?.models ?? []
    const kw = keyword.value.trim().toLowerCase()
    const list = all.filter((m) => {
      if (
        kw &&
        !m.name.toLowerCase().includes(kw) &&
        !m.vendor.toLowerCase().includes(kw)
      )
        return false
      if (channel.value && !m.channels.includes(channel.value)) return false
      if (vendor.value && m.vendor !== vendor.value) return false
      if (type.value && m.type !== type.value) return false
      return true
    })
    if (sort.value === 'default') return list
    const sorted = [...list]
    switch (sort.value) {
      case 'latency':
        sorted.sort((a, b) => a.latency - b.latency)
        break
      case 'tps':
        sorted.sort((a, b) => b.tps - a.tps)
        break
      case 'price':
        sorted.sort(comparePrice)
        break
      case 'health':
        sorted.sort((a, b) => b.health - a.health)
        break
    }
    return sorted
  })

  /** Group filtered models by vendor, preserving catalog vendor order. */
  const groups = computed<VendorGroup[]>(() => {
    const order = catalog.value?.vendors ?? []
    const byVendor = new Map<string, MarketModel[]>()
    for (const m of filtered.value) {
      const bucket = byVendor.get(m.vendor)
      if (bucket) bucket.push(m)
      else byVendor.set(m.vendor, [m])
    }
    return order
      .filter((v) => byVendor.has(v))
      .map((v) => {
        const models = byVendor.get(v)!
        return {
          vendor: v,
          tagline: vendorMeta[v] ?? '',
          models,
          channelCount: new Set(models.flatMap((m) => m.channels)).size,
          healthy: models.filter((m) => m.health >= 95).length,
          degraded: models.filter((m) => m.health >= 80 && m.health < 95)
            .length,
          down: models.filter((m) => m.health < 80).length,
        }
      })
  })

  const resultCount = computed(() => filtered.value.length)
  const hasResults = computed(() => resultCount.value > 0)

  const channelOptions = computed(() => catalog.value?.channels ?? [])
  const vendorOptions = computed(() => catalog.value?.vendors ?? [])

  return {
    loading,
    catalog,
    keyword,
    channel,
    vendor,
    type,
    sort,
    view,
    filtered,
    groups,
    resultCount,
    hasResults,
    channelOptions,
    vendorOptions,
    load,
  }
}
