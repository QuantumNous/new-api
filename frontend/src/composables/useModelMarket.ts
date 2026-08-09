import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { parseUserModels } from '@/api/liveContracts'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'

export function useModelMarket() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(true)
  const models = ref<string[]>([])
  const keyword = ref('')

  async function load() {
    loading.value = true
    try {
      models.value = parseUserModels(await api.get<unknown>('/api/user/models'))
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  const filtered = computed(() => {
    const search = keyword.value.trim().toLowerCase()
    if (!search) return models.value
    return models.value.filter((model) => model.toLowerCase().includes(search))
  })
  const resultCount = computed(() => filtered.value.length)
  const hasResults = computed(() => resultCount.value > 0)

  return {
    loading,
    keyword,
    filtered,
    resultCount,
    hasResults,
    load,
  }
}
