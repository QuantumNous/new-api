import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { isMockApi } from '@/api/client'
import {
  parsePerfMetricsSummary,
  parsePricingModels,
  parseUserModels,
  type PerfModelSummaryContract,
  type PricingModelContract,
} from '@/api/liveContracts'
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

function modelType(endpoints: string[]): MarketModel['type'] {
  if (endpoints.includes('image-generation')) return 'image'
  if (endpoints.includes('embeddings')) return 'embedding'
  if (endpoints.includes('jina-rerank')) return 'rerank'
  if (endpoints.includes('openai-video')) return 'video'
  if (endpoints.some((endpoint) => endpoint.includes('audio'))) return 'audio'
  return 'chat'
}

function modelPrice(pricing: PricingModelContract): MarketModel['price'] {
  if (pricing.quota_type === 1) {
    return { per_call: pricing.model_price }
  }
  const input = pricing.model_ratio * 2
  return {
    input,
    output: input * pricing.completion_ratio,
    ...(pricing.cache_ratio === null
      ? {}
      : { cache_read: input * pricing.cache_ratio }),
  }
}

export function buildLiveModelCatalog(
  names: string[],
  pricing: PricingModelContract[],
  performance: PerfModelSummaryContract[]
): ModelMarketCatalog {
  const pricingByName = new Map(pricing.map((item) => [item.model_name, item]))
  const performanceByName = new Map(
    performance.map((item) => [item.model_name, item])
  )
  const models = names.map((name, index) => {
    const price = pricingByName.get(name)
    const metrics = performanceByName.get(name)
    const vendor = price?.owner_by.trim() || '平台'
    return {
      id: index + 1,
      name,
      vendor,
      type: modelType(price?.supported_endpoint_types ?? []),
      billing:
        price?.billing_mode === 'tiered_expr'
          ? ('tiered' as const)
          : price?.quota_type === 1
            ? ('per_call' as const)
            : ('token' as const),
      price: price ? modelPrice(price) : {},
      context: 0,
      tagline: price?.description ?? '',
      latency: metrics ? Math.max(0, metrics.avg_latency_ms / 1000) : 0,
      tps: metrics ? Math.max(0, metrics.avg_tps) : 0,
      health: metrics ? Math.min(100, Math.max(0, metrics.success_rate)) : 0,
      channels: [],
    }
  })
  return {
    models,
    channels: [],
    vendors: [...new Set(models.map((model) => model.vendor))],
  }
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
      if (isMockApi) {
        catalog.value = await api.get<ModelMarketCatalog>('/api/models/market')
      } else {
        const [rawNames, rawPricing, rawPerformance] = await Promise.all([
          api.get<unknown>('/api/user/models'),
          api.get<unknown>('/api/pricing'),
          api.get<unknown>('/api/perf-metrics/summary'),
        ])
        catalog.value = buildLiveModelCatalog(
          parseUserModels(rawNames),
          parsePricingModels(rawPricing),
          parsePerfMetricsSummary(rawPerformance)
        )
      }
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
