import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import {
  groupByVendor,
  scoreChannels,
  type ChannelRoutingMetrics,
  type ScoredChannel,
} from '@/utils/routeScore'

export type { ScoredChannel } from '@/utils/routeScore'

export interface VendorRouteList {
  vendor: string
  channels: ScoredChannel[]
}

export function useAutoRoute() {
  const { t } = useI18n()
  const toast = useToast()

  const loading = ref(false)
  const lastUpdated = ref<Date | null>(null)
  const raw = ref<ChannelRoutingMetrics[]>([])
  const modelFilter = ref<string>('')

  /**
   * Routing picks a channel within a vendor, never across vendors, so
   * channels are grouped by supplier first and scored inside each group.
   * Every group's first entry is that vendor's current optimum.
   */
  const vendorList = computed<VendorRouteList[]>(() => {
    const result: VendorRouteList[] = []
    groupByVendor(raw.value).forEach((channels, vendor) => {
      const scored = scoreChannels(channels)
      if (scored.length) result.push({ vendor, channels: scored })
    })
    return result.sort(
      (a, b) =>
        b.channels.length - a.channels.length ||
        a.vendor.localeCompare(b.vendor)
    )
  })

  async function load() {
    loading.value = true
    try {
      const data = await api.get<ChannelRoutingMetrics[]>('/api/data/route')
      raw.value = data
      lastUpdated.value = new Date()
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  return { loading, lastUpdated, vendorList, modelFilter, load }
}
