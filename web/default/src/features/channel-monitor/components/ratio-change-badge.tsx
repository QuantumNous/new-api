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
import { StatusBadge } from '@/components/status-badge'

import { formatChangePercent, getRatioChange } from '../lib/format'

type RatioChangeBadgeProps = {
  current: number | null
  previous: number | null
}

export function RatioChangeBadge(props: RatioChangeBadgeProps) {
  const change = getRatioChange(props.current, props.previous)

  if (change.direction === 'baseline') {
    return (
      <StatusBadge
        label={props.current == null ? '未记录' : '基准值'}
        variant='neutral'
        copyable={false}
      />
    )
  }
  if (change.direction === 'same') {
    return <StatusBadge label='无变化' variant='neutral' copyable={false} />
  }

  return (
    <StatusBadge
      label={formatChangePercent(change.percent)}
      variant={change.direction === 'up' ? 'warning' : 'success'}
      copyable={false}
    />
  )
}
