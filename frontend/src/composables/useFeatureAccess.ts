import { computed, type ComputedRef } from 'vue'

import { isMockApi } from '@/api/client'
import type { FeatureStatus } from '@/api/public'
import { useAppStore } from '@/stores'

export interface FeatureAccess {
  status: ComputedRef<FeatureStatus>
  disabled: ComputedRef<boolean>
  readOnly: ComputedRef<boolean>
}

export function useFeatureAccess(
  feature: string,
  fallback: FeatureStatus
): FeatureAccess {
  const app = useAppStore()
  const status = computed(() => app.featureStatus(feature, fallback))

  return {
    status,
    disabled: computed(() => status.value === 'disabled'),
    // Stateful mock workflows remain available to tests and local design work.
    // Production HTTP mode only permits writes after the backend marks live.
    readOnly: computed(() => !isMockApi && status.value !== 'live'),
  }
}
