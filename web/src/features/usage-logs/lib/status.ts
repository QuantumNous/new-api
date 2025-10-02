import type { StatusBadgeProps } from '@/components/status-badge'

/**
 * Generic status mapping utility
 * Creates a function to map status values to labels and variants
 */
export function createStatusMapper<T extends string>(mapping: {
  [key in T]?: { label: string; variant: StatusBadgeProps['variant'] }
}) {
  return {
    getLabel: (status: string, defaultLabel = 'Unknown'): string => {
      return mapping[status as T]?.label ?? defaultLabel
    },
    getVariant: (
      status: string,
      defaultVariant: StatusBadgeProps['variant'] = 'neutral'
    ): StatusBadgeProps['variant'] => {
      return mapping[status as T]?.variant ?? defaultVariant
    },
  }
}
