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
import { formatAbsoluteTime, formatLatency, healthText } from '../lib/format'
import { statusToHealth } from '../lib/status-view'
import type { ModelStatusTimelinePoint } from '../types'

const pointClassName = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-400',
  down: 'bg-red-500',
  unknown: 'bg-slate-400',
}

export function StatusTimeline(props: { history: ModelStatusTimelinePoint[] }) {
  if (props.history.length === 0) {
    return <div className='text-muted-foreground text-xs'>暂无最近状态采样</div>
  }

  return (
    <div className='space-y-1.5'>
      <div className='flex h-6 items-end gap-0.5' aria-label='最近 5 小时状态'>
        {props.history.map((point) => {
          const health = statusToHealth(point.status)
          return (
            <span
              key={`${point.timestamp}-${point.status}`}
              role='img'
              aria-label={`${formatAbsoluteTime(point.timestamp)}，${healthText(health)}，延迟 ${formatLatency(point.latency)}`}
              title={`${formatAbsoluteTime(point.timestamp)} · ${healthText(health)} · ${formatLatency(point.latency)}`}
              className={cn(
                'h-5 min-w-1 flex-1 rounded-[2px] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                pointClassName[health]
              )}
            />
          )
        })}
      </div>
      <div className='text-muted-foreground flex justify-between text-[11px]'>
        <span>5h</span>
        <span>现在</span>
      </div>
    </div>
  )
}
