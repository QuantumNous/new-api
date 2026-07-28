import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import type { Activity, ActivitySummary } from '@/types/console'
import { ApiError } from '@/api/types'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

/**
 * Activity center state + actions. Owns loading, filtering and the
 * claim / checkin flows so ActivityView.vue stays focused on layout.
 * Failures keep the cached list (contract §4 convention).
 */
export function useActivity() {
  const { t } = useI18n()
  const toast = useToast()
  const auth = useAuthStore()

  const activities = ref<Activity[]>([])
  const summary = ref<ActivitySummary>({
    claimable: 0,
    reward_earned: 0,
    ongoing: 0,
  })
  const loading = ref(true)
  const claiming = ref(false)

  const ongoing = computed(() =>
    activities.value.filter((a) => a.status === 'ongoing')
  )
  const ended = computed(() =>
    activities.value.filter((a) => a.status !== 'ongoing')
  )

  async function load() {
    loading.value = true
    try {
      const data = await api.get<{
        activities: Activity[]
        summary: ActivitySummary
      }>('/api/activity/self')
      activities.value = data.activities
      summary.value = data.summary
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : t('common.failed')
      )
    } finally {
      loading.value = false
    }
  }

  async function checkin(id: number) {
    claiming.value = true
    try {
      const res = await api.post<{ reward: number; streak: number }>(
        '/api/activity/checkin',
        { activity_id: id }
      )
      toast.success(t('activity.checkin.success', { reward: res.reward }))
      await Promise.all([auth.fetchSelf(), load()])
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
    } finally {
      claiming.value = false
    }
  }

  async function claim(id: number, taskId?: string) {
    claiming.value = true
    try {
      const res = await api.post<{ message: string; reward: number }>(
        '/api/activity/claim',
        { activity_id: id, task_id: taskId }
      )
      toast.success(res.message || t('activity.claim.success'))
      await Promise.all([auth.fetchSelf(), load()])
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : String(error))
    } finally {
      claiming.value = false
    }
  }

  return {
    activities,
    summary,
    loading,
    claiming,
    ongoing,
    ended,
    load,
    checkin,
    claim,
  }
}
