/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
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
    return 'bg-warning/10 text-warning'
  }
  if (ratio < 1) {
    return 'bg-info/10 text-info'
  }
  return 'bg-muted text-muted-foreground'
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
          'inline-flex h-6 items-center rounded-full px-2 font-mono text-sm leading-none font-medium tabular-nums',
          getGroupRatioClassName(ratio)
        )}
      >
        <span>{ratio}x</span>
      </span>
    </span>
  )
}
