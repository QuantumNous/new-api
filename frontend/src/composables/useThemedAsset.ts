import { computed, type ComputedRef } from 'vue'

import { useTheme } from '@/composables/useTheme'

/** Selects a static asset without duplicating theme state or DOM observers. */
export function useThemedAsset(
  dayAsset: string,
  darkAsset: string
): ComputedRef<string> {
  const { resolvedTheme } = useTheme()

  return computed(() => (resolvedTheme.value === 'dark' ? darkAsset : dayAsset))
}
