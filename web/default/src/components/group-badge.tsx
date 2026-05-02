import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { StatusBadge, type StatusBadgeProps } from './status-badge'

type GroupBadgeProps = Omit<
  StatusBadgeProps,
  'autoColor' | 'label' | 'variant'
> & {
  group?: string | null
  label?: string
  ratio?: number | null
}

function getGroupRatioClassName(ratio: number): string {
  if (ratio > 1) {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
  }
  if (ratio < 1) {
    return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300'
  }
  return 'border-border bg-muted text-muted-foreground'
}

function getGroupLabel(params: {
  labelOverride?: string
  groupName?: string
  isAutoGroup: boolean
  isEmptyGroup: boolean
  t: (key: string) => string
}): string {
  if (params.labelOverride) return params.labelOverride
  if (params.isEmptyGroup) return params.t('User Group')
  if (params.isAutoGroup) return params.t('Auto')
  return params.groupName ?? ''
}

export function GroupBadge(props: GroupBadgeProps) {
  const { t } = useTranslation()
  const {
    group,
    label: labelOverride,
    ratio,
    copyable = false,
    showDot,
    ...badgeProps
  } = props
  const groupName = group?.trim()
  const isAutoGroup = groupName === 'auto'
  const isEmptyGroup = !groupName
  const isSpecialGroup = isAutoGroup || isEmptyGroup
  const label = getGroupLabel({
    labelOverride,
    groupName,
    isAutoGroup,
    isEmptyGroup,
    t,
  })

  const badge = (
    <StatusBadge
      {...badgeProps}
      copyable={copyable}
      label={label}
      showDot={showDot ?? (isSpecialGroup ? false : undefined)}
      variant={isSpecialGroup ? 'neutral' : undefined}
      autoColor={isSpecialGroup ? undefined : groupName}
    />
  )

  if (ratio == null) {
    return badge
  }

  return (
    <span className='inline-flex items-center gap-2 text-xs'>
      {badge}
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums',
          getGroupRatioClassName(ratio)
        )}
      >
        <span className='size-1 rounded-full bg-current opacity-60' />
        <span>{ratio}x</span>
      </span>
    </span>
  )
}
