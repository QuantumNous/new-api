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
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { formatTimestampToDate } from '@/lib/format'

import type { ChannelMonitorItem } from '../types'

type ChannelMonitorSmartScheduleCellProps = {
  channel: ChannelMonitorItem
  pending: boolean
  onUpdate: (excluded: boolean) => void
}

export function ChannelMonitorSmartScheduleCell(
  props: ChannelMonitorSmartScheduleCellProps
) {
  const participating = !props.channel.smart_schedule_excluded

  let statusContent = (
    <span className='text-muted-foreground text-xs'>等待首次调度</span>
  )
  if (props.channel.last_schedule_status === 'succeeded') {
    statusContent = (
      <div className='flex flex-wrap items-center gap-1.5 text-xs'>
        <Badge variant='secondary'>已调度</Badge>
        {props.channel.last_schedule_score != null && (
          <span className='tabular-nums'>
            得分 {(props.channel.last_schedule_score * 100).toFixed(1)}
          </span>
        )}
        <span className='text-muted-foreground'>
          {formatTimestampToDate(props.channel.last_schedule_time)}
        </span>
      </div>
    )
  } else if (props.channel.last_schedule_status === 'skipped') {
    statusContent = (
      <div className='flex min-w-0 items-center gap-1.5 text-xs'>
        <Badge variant='outline'>已跳过</Badge>
        <span
          className='text-muted-foreground truncate'
          title={props.channel.last_schedule_error}
        >
          {props.channel.last_schedule_error || '暂不满足调度条件'}
        </span>
      </div>
    )
  } else if (props.channel.last_schedule_status === 'failed') {
    statusContent = (
      <div className='flex min-w-0 items-center gap-1.5 text-xs'>
        <Badge variant='destructive'>失败</Badge>
        <span
          className='text-destructive truncate'
          title={props.channel.last_schedule_error}
        >
          {props.channel.last_schedule_error || '更新优先级或权重失败'}
        </span>
      </div>
    )
  }

  return (
    <div className='flex w-full min-w-0 flex-col items-start gap-2'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums'>
        <span>
          优先级 <strong>{props.channel.priority}</strong>
        </span>
        <span>
          权重 <strong>{props.channel.weight}</strong>
        </span>
        {props.pending && <Spinner className='size-3.5' />}
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex items-center gap-2'>
          <Switch
            checked={participating}
            disabled={props.pending}
            onCheckedChange={(checked) => props.onUpdate(!checked)}
            aria-label={`${participating ? '停止' : '启用'} ${props.channel.name} 的智能调度`}
          />
          <span className='text-xs'>参与调度</span>
        </div>
      </div>

      {statusContent}
    </div>
  )
}
