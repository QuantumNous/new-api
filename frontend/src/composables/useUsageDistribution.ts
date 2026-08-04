import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'

export interface UsageDistributionPoint {
  date: string
  requests: number
  consume: number
  tokens: number
}

export function useUsageDistribution() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(true)
  const points = ref<UsageDistributionPoint[]>([])

  async function load() {
    loading.value = true
    try {
      points.value = await api.get<UsageDistributionPoint[]>(
        '/api/data/distribution/self'
      )
    } catch (error) {
      points.value = []
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  return { loading, points, load }
}
