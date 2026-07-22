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
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CHANNEL_STATUS } from '@/features/channels/constants'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getChannelMonitorStatusLabel } from '../constants'
import { formatMonitorRatio } from '../lib/format'
import type {
  ChannelMonitorItem,
  ChannelMonitorPerformanceMetric,
  ChannelMonitorSuccessMetric,
} from '../types'
import {
  ChannelMonitorFirstTokenValue,
  ChannelMonitorTPSValue,
} from './channel-monitor-performance-value'
import { ChannelMonitorStatusBadge } from './channel-monitor-status-badge'
import { ChannelMonitorSuccessRateValue } from './channel-monitor-success-rate-value'

const PERFORMANCE_PAGE_SIZE = 20

type ChannelMonitorModelPerformanceViewProps = {
  channels: ChannelMonitorItem[]
  metrics: ChannelMonitorPerformanceMetric[]
  successMetrics: ChannelMonitorSuccessMetric[]
  successMetricsAvailable: boolean
  selectedModel: string
  search: string
  isLoading: boolean
  isError: boolean
  onOpenSuccessDetail: (channel: ChannelMonitorItem, modelName: string) => void
}

export function ChannelMonitorModelPerformanceView(
  props: ChannelMonitorModelPerformanceViewProps
) {
  const [page, setPage] = useState(1)
  const rows = useMemo(() => {
    const metricByChannel = new Map(
      props.metrics
        .filter((metric) => metric.model_name === props.selectedModel)
        .map((metric) => [metric.channel_id, metric])
    )
    const successMetricByChannel = new Map(
      props.successMetrics
        .filter((metric) => metric.model_name === props.selectedModel)
        .map((metric) => [metric.channel_id, metric])
    )
    const normalizedSearch = props.search.trim().toLocaleLowerCase()
    return props.channels
      .filter((channel) => {
        if (!normalizedSearch) return true
        return (
          channel.name.toLocaleLowerCase().includes(normalizedSearch) ||
          String(channel.id).includes(normalizedSearch)
        )
      })
      .sort((first, second) => {
        const firstEnabled = first.status === CHANNEL_STATUS.ENABLED
        const secondEnabled = second.status === CHANNEL_STATUS.ENABLED
        if (firstEnabled !== secondEnabled) return firstEnabled ? -1 : 1

        const firstRatio =
          first.cost_ratio != null && Number.isFinite(first.cost_ratio)
            ? first.cost_ratio
            : null
        const secondRatio =
          second.cost_ratio != null && Number.isFinite(second.cost_ratio)
            ? second.cost_ratio
            : null
        if (firstRatio != null && secondRatio != null) {
          const ratioOrder = firstRatio - secondRatio
          if (ratioOrder !== 0) return ratioOrder
        } else if (firstRatio != null) {
          return -1
        } else if (secondRatio != null) {
          return 1
        }

        const nameOrder = first.name.localeCompare(second.name)
        return nameOrder !== 0 ? nameOrder : first.id - second.id
      })
      .map((channel) => ({
        channel,
        metric: metricByChannel.get(channel.id) ?? null,
        successMetric: successMetricByChannel.get(channel.id) ?? null,
      }))
  }, [
    props.channels,
    props.metrics,
    props.search,
    props.selectedModel,
    props.successMetrics,
  ])

  if (props.isLoading) {
    return <Skeleton className='h-96 w-full rounded-lg' />
  }
  if (props.isError) {
    return (
      <Empty className='min-h-72'>
        <EmptyHeader>
          <EmptyTitle>模型性能加载失败</EmptyTitle>
          <EmptyDescription>请刷新后重试</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (!props.selectedModel) {
    return (
      <Empty className='min-h-72'>
        <EmptyHeader>
          <EmptyTitle>暂无模型性能记录</EmptyTitle>
          <EmptyDescription>
            当前时间范围内没有可用的流式请求样本
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (rows.length === 0) {
    return (
      <Empty className='min-h-72'>
        <EmptyHeader>
          <EmptyTitle>没有匹配的渠道</EmptyTitle>
          <EmptyDescription>当前搜索条件下没有可展示的渠道</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / PERFORMANCE_PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleRows = rows.slice(
    (currentPage - 1) * PERFORMANCE_PAGE_SIZE,
    currentPage * PERFORMANCE_PAGE_SIZE
  )

  return (
    <div className='flex flex-col gap-3'>
      <div className='overflow-hidden rounded-lg border'>
        <Table className='min-w-[1100px]'>
          <TableHeader>
            <TableRow>
              <TableHead className='w-14 text-center'>排名</TableHead>
              <TableHead>渠道</TableHead>
              <TableHead>成本倍率</TableHead>
              <TableHead>平均首字</TableHead>
              <TableHead>平均 TPS</TableHead>
              <TableHead title='按真实上游调用统计，包含重试过程中的失败'>
                成功率
              </TableHead>
              <TableHead>有效样本</TableHead>
              <TableHead>最后请求</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, rowIndex) => {
              const channelEnabled =
                row.channel.status === CHANNEL_STATUS.ENABLED
              const channelStatusLabel = `渠道状态：${getChannelMonitorStatusLabel(row.channel.status)}`
              return (
                <TableRow key={`${props.selectedModel}:${row.channel.id}`}>
                  <TableCell className='text-muted-foreground text-center font-mono text-xs'>
                    {row.metric || row.successMetric
                      ? (currentPage - 1) * PERFORMANCE_PAGE_SIZE + rowIndex + 1
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className='flex min-w-44 items-center gap-2'>
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          channelEnabled ? 'bg-success' : 'bg-destructive'
                        )}
                        role='img'
                        aria-label={channelStatusLabel}
                        title={channelStatusLabel}
                      />
                      <div className='flex min-w-0 flex-col gap-0.5'>
                        <span className='truncate font-medium'>
                          {row.channel.name}
                        </span>
                        {!channelEnabled && (
                          <ChannelMonitorStatusBadge
                            status={row.channel.status}
                          />
                        )}
                        <span className='text-muted-foreground text-xs'>
                          ID {row.channel.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className='font-mono font-semibold'>
                      {formatMonitorRatio(row.channel.cost_ratio)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ChannelMonitorFirstTokenValue
                      value={row.metric?.average_first_token_ms ?? null}
                    />
                  </TableCell>
                  <TableCell>
                    <ChannelMonitorTPSValue
                      value={row.metric?.average_tps ?? null}
                    />
                  </TableCell>
                  <TableCell>
                    <ChannelMonitorSuccessRateValue
                      rate={row.successMetric?.actual_success_rate}
                      successCount={row.successMetric?.actual_success_count}
                      sampleCount={row.successMetric?.actual_sample_count}
                      available={props.successMetricsAvailable}
                      loading={props.isLoading}
                      error={props.isError}
                      onClick={() =>
                        props.onOpenSuccessDetail(
                          row.channel,
                          props.selectedModel
                        )
                      }
                      detailLabel={`查看 ${row.channel.name} 的 ${props.selectedModel} 成功率明细`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className='flex min-w-28 flex-col gap-0.5 text-xs'>
                      {row.metric ? (
                        <>
                          <span>{row.metric.sample_count} 次请求</span>
                          <div className='flex items-baseline gap-1.5'>
                            <span className='text-muted-foreground'>首字</span>
                            <ChannelMonitorFirstTokenValue
                              value={row.metric.latest_first_token_ms}
                            />
                          </div>
                          <div className='flex items-baseline gap-1.5'>
                            <span className='text-muted-foreground'>TPS</span>
                            <ChannelMonitorTPSValue
                              value={row.metric.latest_tps}
                            />
                          </div>
                        </>
                      ) : (
                        <span className='text-muted-foreground'>暂无样本</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.metric
                      ? formatTimestampToDate(row.metric.last_used_time)
                      : '-'}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className='flex items-center justify-end gap-2'>
          <Button
            variant='outline'
            size='icon-sm'
            aria-label='上一页'
            title='上一页'
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <span className='text-muted-foreground min-w-24 text-center text-xs tabular-nums'>
            第 {currentPage} / {totalPages} 页
          </span>
          <Button
            variant='outline'
            size='icon-sm'
            aria-label='下一页'
            title='下一页'
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
      )}
    </div>
  )
}
