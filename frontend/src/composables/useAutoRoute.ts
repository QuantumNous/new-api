import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import {
  groupByVendor,
  scoreChannels,
  type ChannelRoutingMetrics,
  type ScoreBreakdown,
} from '@/utils/routeScore'
import {
  summarizeRouteHealth,
  type RouteHealthSummary,
} from '@/utils/routeHealth'

export interface RouteChannelRow extends ChannelRoutingMetrics {
  rank: number | null
  score: number | null
  breakdown: ScoreBreakdown | null
}

export interface VendorRouteList {
  vendor: string
  channels: RouteChannelRow[]
  activeCount: number
  monitor: RouteHealthSummary
}

export function buildVendorRouteList(
  rawChannels: ChannelRoutingMetrics[],
  nowTimestamp?: number
): VendorRouteList[] {
  const result: VendorRouteList[] = []
  groupByVendor(rawChannels).forEach((channels, vendor) => {
    const scored = scoreChannels(channels)
    const ranked: RouteChannelRow[] = scored.map((channel, index) => ({
      ...channel,
      rank: index + 1,
    }))
    const inactive: RouteChannelRow[] = channels
      .filter((channel) => channel.status !== 1)
      .map((channel) => ({
        ...channel,
        rank: null,
        score: null,
        breakdown: null,
      }))

    result.push({
      vendor,
      channels: [...ranked, ...inactive],
      activeCount: ranked.length,
      monitor: summarizeRouteHealth(channels, nowTimestamp),
    })
  })
  return result.sort(
    (a, b) =>
      b.channels.length - a.channels.length || a.vendor.localeCompare(b.vendor)
  )
}

export function useAutoRoute() {
  const { t } = useI18n()
  const toast = useToast()

  const loading = ref(false)
  const lastUpdated = ref<Date | null>(null)
  const raw = ref<ChannelRoutingMetrics[]>([])
  const modelFilter = ref<string>('')
  const routeRequest = useLatestRequest()

  /**
   * Routing picks a channel within a vendor, never across vendors, so
   * channels are grouped by supplier first and scored inside each group.
   * Disabled channels stay visible after the ranked active rows so an
   * unavailable vendor never disappears from the monitoring surface.
   */
  const vendorList = computed<VendorRouteList[]>(() => {
    return buildVendorRouteList(raw.value)
  })

  async function load() {
    loading.value = true
    const result = await routeRequest.run((signal) =>
      api.get<ChannelRoutingMetrics[]>(
        '/api/next/admin/dashboard/routes',
        undefined,
        { signal }
      )
    )
    if (result.stale) return
    loading.value = false
    if (!result.ok) {
      toast.error(
        result.error instanceof ApiError
          ? result.error.message
          : t('common.failed')
      )
      return
    }
    raw.value = result.value
    lastUpdated.value = new Date()
  }

  return { loading, lastUpdated, vendorList, modelFilter, load }
}
