import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import type { MyChannel } from '@/types/console'

/** Manageable "my channels" list backing the marketplace 我的渠道 tab. */
export function useMyChannels() {
  const { t } = useI18n()
  const toast = useToast()
  const loading = ref(false)
  const channels = ref<MyChannel[]>([])
  /** ids with an in-flight mutation, to guard against double clicks */
  const pending = ref(new Set<number>())

  async function load() {
    loading.value = true
    try {
      const data = await api.get<{ channels: MyChannel[] }>(
        '/api/market/my-channels'
      )
      channels.value = data.channels
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  async function toggle(id: number): Promise<string> {
    if (pending.value.has(id)) return ''
    pending.value.add(id)
    try {
      const data = await api.put<{ channel: MyChannel; message: string }>(
        `/api/market/my-channels/${id}`
      )
      const idx = channels.value.findIndex((c) => c.id === id)
      if (idx !== -1) channels.value[idx] = data.channel
      return data.message
    } finally {
      pending.value.delete(id)
    }
  }

  async function remove(id: number): Promise<string> {
    if (pending.value.has(id)) return ''
    pending.value.add(id)
    try {
      const data = await api.delete<{ message: string }>(
        `/api/market/my-channels/${id}`
      )
      channels.value = channels.value.filter((c) => c.id !== id)
      return data.message
    } finally {
      pending.value.delete(id)
    }
  }

  return { loading, channels, pending, load, toggle, remove }
}
