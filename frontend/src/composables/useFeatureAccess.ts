import { computed, type ComputedRef } from 'vue'

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
    readOnly: computed(() => status.value !== 'live'),
  }
}
