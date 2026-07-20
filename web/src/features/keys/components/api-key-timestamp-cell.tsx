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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatTimestampRelative, formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ApiKeyTimestampCellProps {
  timestamp: number
  now: number
  locale?: string
  justNowLabel: string
  className?: string
}

export function ApiKeyTimestampCell(props: ApiKeyTimestampCellProps) {
  if (!props.timestamp || props.timestamp === -1) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  const timestampMs = props.timestamp * 1000
  const isJustNow = timestampMs <= props.now && props.now - timestampMs < 60_000
  const relativeTime = isJustNow
    ? props.justNowLabel
    : formatTimestampRelative(props.timestamp, 'seconds', props.locale)
  const absoluteTime = formatTimestampToDate(props.timestamp)

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            dateTime={new Date(timestampMs).toISOString()}
            tabIndex={0}
            className={cn(
              'block truncate font-mono text-xs tabular-nums',
              props.className
            )}
          />
        }
      >
        {relativeTime}
      </TooltipTrigger>
      <TooltipContent>
        <span className='font-mono tabular-nums'>{absoluteTime}</span>
      </TooltipContent>
    </Tooltip>
  )
}
