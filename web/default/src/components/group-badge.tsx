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

import { getIdentityTextColorClass } from '@/lib/colors'
import { cn } from '@/lib/utils'

import {
  CopyableStatusBadge,
  StatusBadge,
  type StatusBadgeProps,
} from './status-badge'

type GroupBadgeProps = Omit<StatusBadgeProps, 'children' | 'variant'> & {
  group?: string | null
  label?: string
  ratio?: number | null
  /**
   * Click-to-copy the group name. Enabled by default; auto/empty groups and
   * masked labels are never copyable. Set to false for badges that carry
   * their own click behavior (e.g. selection toggles).
   */
  copyable?: boolean
}

function getGroupRatioVariant(
  ratio: number
): NonNullable<StatusBadgeProps['variant']> {
  if (ratio > 1) return 'warning'
  if (ratio < 1) return 'info'
  return 'neutral'
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
    className,
    copyable = true,
    ...badgeProps
  } = props
  const groupName = group?.trim()
  const isAutoGroup = groupName === 'auto'
  const isEmptyGroup = !groupName
  const colorKey = groupName || labelOverride || 'group'
  const label = getGroupLabel({
    labelOverride,
    groupName,
    isAutoGroup,
    isEmptyGroup,
    t,
  })

  const badgeClassName = cn(
    'shrink-0 overflow-visible',
    getIdentityTextColorClass(colorKey),
    className
  )
  const canCopy = copyable && !isAutoGroup && !isEmptyGroup && !labelOverride
  // CopyableStatusBadge owns the click/render behavior, so drop any
  // caller-provided handlers when the badge is in copy mode.
  const { onClick: _onClick, render: _render, ...copyBadgeProps } = badgeProps

  const badge = canCopy ? (
    <CopyableStatusBadge
      {...copyBadgeProps}
      value={groupName}
      variant='neutral'
      appearance='plain'
      className={badgeClassName}
    >
      {label}
    </CopyableStatusBadge>
  ) : (
    <StatusBadge
      {...badgeProps}
      variant='neutral'
      appearance='plain'
      className={badgeClassName}
    >
      {label}
    </StatusBadge>
  )

  if (ratio == null) {
    return badge
  }

  return (
    <span className='inline-flex w-max shrink-0 items-center gap-2 text-xs whitespace-nowrap'>
      <span className='inline-flex shrink-0'>{badge}</span>
      <StatusBadge
        variant={getGroupRatioVariant(ratio)}
        appearance='plain'
        className='shrink-0 tabular-nums'
      >
        {ratio}x
      </StatusBadge>
    </span>
  )
}
