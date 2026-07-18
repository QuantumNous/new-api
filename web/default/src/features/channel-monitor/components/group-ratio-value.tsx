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
import { cn } from '@/lib/utils'

import { formatMonitorRatio, getChannelGroupTargetRatio } from '../lib/format'

type GroupRatioValueProps = {
  groupRatio: number
  upstreamRatio: number | null
  coefficient: number
}

export function GroupRatioValue(props: GroupRatioValueProps) {
  const expectedGroupRatio = getChannelGroupTargetRatio(
    props.upstreamRatio,
    props.coefficient
  )
  let colorClassName = 'text-foreground'
  let statusLabel = '暂时无法比较'

  if (expectedGroupRatio != null) {
    if (Math.abs(props.groupRatio - expectedGroupRatio) <= 1e-9) {
      colorClassName = 'text-warning'
      statusLabel = '等于上游倍率乘以系数'
    } else if (props.groupRatio < expectedGroupRatio) {
      colorClassName = 'text-destructive'
      statusLabel = '低于上游倍率乘以系数'
    } else {
      colorClassName = 'text-success'
      statusLabel = '高于上游倍率乘以系数'
    }
  }

  const formattedRatio = formatMonitorRatio(props.groupRatio)

  return (
    <span
      className={cn('font-semibold', colorClassName)}
      aria-label={`分组倍率 ${formattedRatio}，${statusLabel}`}
      title={statusLabel}
    >
      {formattedRatio}
    </span>
  )
}
