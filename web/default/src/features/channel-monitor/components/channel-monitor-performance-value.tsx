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
import { textColorMap } from '@/components/status-badge'
import {
  getFirstResponseTimeColor,
  getThroughputColor,
} from '@/features/usage-logs/lib/format'
import { formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type ChannelMonitorPerformanceValueProps = {
  value: number | null
  className?: string
}

export function ChannelMonitorFirstTokenValue(
  props: ChannelMonitorPerformanceValueProps
) {
  if (props.value == null || !Number.isFinite(props.value)) {
    return <span className='text-muted-foreground'>-</span>
  }
  const variant = getFirstResponseTimeColor(props.value / 1000)
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        textColorMap[variant],
        props.className
      )}
    >
      {formatUseTime(props.value / 1000)}
    </span>
  )
}

export function ChannelMonitorTPSValue(
  props: ChannelMonitorPerformanceValueProps
) {
  if (props.value == null || !Number.isFinite(props.value)) {
    return <span className='text-muted-foreground'>-</span>
  }
  const variant = getThroughputColor(props.value)
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        textColorMap[variant],
        props.className
      )}
    >
      {Math.round(props.value)} t/s
    </span>
  )
}
