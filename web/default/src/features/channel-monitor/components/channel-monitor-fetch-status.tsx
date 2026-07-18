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
import { Alert02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Badge } from '@/components/ui/badge'
import { formatTimestampToDate } from '@/lib/format'

import type { ChannelMonitorItem } from '../types'

type ChannelMonitorFetchStatusProps = {
  channel: Pick<
    ChannelMonitorItem,
    | 'last_fetch_status'
    | 'last_fetch_time'
    | 'consecutive_failures'
    | 'upstream'
  >
}

export function ChannelMonitorFetchStatus(
  props: ChannelMonitorFetchStatusProps
) {
  if (props.channel.last_fetch_status === 'failed') {
    const failureCount = Math.max(1, props.channel.consecutive_failures)

    return (
      <div className='flex max-w-96 min-w-64 flex-col gap-1.5 whitespace-normal'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='destructive'>
            <HugeiconsIcon icon={Alert02Icon} data-icon='inline-start' />
            更新失败
          </Badge>
          <span className='text-destructive text-xs'>
            连续失败 {failureCount} 次
          </span>
        </div>
        {props.channel.last_fetch_time > 0 && (
          <span className='text-muted-foreground text-xs'>
            最后尝试：{formatTimestampToDate(props.channel.last_fetch_time)}
          </span>
        )}
      </div>
    )
  }

  if (props.channel.last_fetch_status === 'succeeded') {
    return (
      <div className='flex min-w-32 flex-col items-start gap-1'>
        <Badge
          variant='secondary'
          className='bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        >
          更新成功
        </Badge>
        {props.channel.last_fetch_time > 0 && (
          <span className='text-muted-foreground text-xs'>
            {formatTimestampToDate(props.channel.last_fetch_time)}
          </span>
        )}
      </div>
    )
  }

  if (props.channel.upstream) {
    return <Badge variant='outline'>等待首次更新</Badge>
  }

  return <span className='text-muted-foreground text-xs'>未配置上游</span>
}
