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
import { ViewIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ChannelMonitorSuccessRateValueProps = {
  rate: number | null | undefined
  successCount: number | null | undefined
  sampleCount: number | null | undefined
  available: boolean
  loading: boolean
  error: boolean
  onClick?: () => void
  detailLabel?: string
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 2,
})

export function ChannelMonitorSuccessRateValue(
  props: ChannelMonitorSuccessRateValueProps
) {
  if (props.loading) {
    return <Skeleton className='h-9 w-20' />
  }
  if (props.error) {
    return <span className='text-destructive text-xs'>加载失败</span>
  }
  if (!props.available) {
    return <span className='text-muted-foreground text-xs'>日志未开启</span>
  }
  if (
    props.rate == null ||
    !Number.isFinite(props.rate) ||
    props.sampleCount == null ||
    props.sampleCount <= 0
  ) {
    return <span className='text-muted-foreground text-xs'>暂无样本</span>
  }

  let rateClassName = 'text-destructive'
  if (props.rate >= 0.9) {
    rateClassName = 'text-success'
  } else if (props.rate >= 0.7) {
    rateClassName = 'text-warning'
  }
  const successCount = props.successCount ?? 0
  const value = (
    <span
      className='flex min-w-20 flex-col items-start gap-0.5'
      title={
        props.onClick
          ? undefined
          : `${successCount} 次成功 / ${props.sampleCount} 次统计`
      }
    >
      <span
        className={cn('font-mono font-semibold tabular-nums', rateClassName)}
      >
        {percentFormatter.format(props.rate)}
      </span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {successCount} / {props.sampleCount} 次
      </span>
    </span>
  )
  if (!props.onClick) {
    return value
  }
  const detailLabel = props.detailLabel ?? '查看成功率明细'
  return (
    <Button
      type='button'
      variant='ghost'
      className='h-auto min-w-0 justify-start gap-1 px-1 py-0.5 text-left whitespace-normal'
      onClick={props.onClick}
      aria-label={detailLabel}
      title={`${detailLabel}；${successCount} 次成功 / ${props.sampleCount} 次统计`}
    >
      {value}
      <HugeiconsIcon icon={ViewIcon} data-icon='inline-end' />
    </Button>
  )
}
