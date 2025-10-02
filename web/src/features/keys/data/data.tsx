import { type StatusBadgeProps } from '@/components/status-badge'

export const apiKeyStatusConfig: Record<
  number,
  Pick<StatusBadgeProps, 'variant' | 'showDot'> & { label: string }
> = {
  1: {
    label: 'Enabled',
    variant: 'success',
    showDot: true,
  },
  2: {
    label: 'Disabled',
    variant: 'neutral',
    showDot: true,
  },
  3: {
    label: 'Expired',
    variant: 'warning',
    showDot: true,
  },
  4: {
    label: 'Exhausted',
    variant: 'danger',
    showDot: true,
  },
}

export const apiKeyStatuses = Object.entries(apiKeyStatusConfig).map(
  ([value, config]) => ({
    label: config.label,
    value: Number(value),
  })
)
