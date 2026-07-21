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
  Alert02Icon,
  Analytics01Icon,
  Refresh01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
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

import { getChannelMonitorSuccessDetail } from '../api'
import type {
  ChannelMonitorFailureCategory,
  ChannelMonitorItem,
  ChannelMonitorPerformanceRangeMinutes,
  ChannelMonitorSuccessDetailTarget,
  ChannelMonitorSuccessMode,
  ChannelMonitorSuccessSummary,
} from '../types'

type ChannelMonitorSuccessDetailDialogProps = {
  target: ChannelMonitorSuccessDetailTarget
  channels: ChannelMonitorItem[]
  rangeMinutes: ChannelMonitorPerformanceRangeMinutes
  rangeLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type SuccessModeSummary = {
  successCount: number
  failureCount: number
  sampleCount: number
  successRate: number
}

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 2,
})

function getModeSummary(
  summary: ChannelMonitorSuccessSummary,
  mode: ChannelMonitorSuccessMode
): SuccessModeSummary {
  if (mode === 'final') {
    return {
      successCount: summary.final_success_count,
      failureCount: summary.final_failure_count,
      sampleCount: summary.final_sample_count,
      successRate: summary.final_success_rate,
    }
  }
  return {
    successCount: summary.actual_success_count,
    failureCount: summary.actual_failure_count,
    sampleCount: summary.actual_sample_count,
    successRate: summary.actual_success_rate,
  }
}

function getRateClassName(rate: number) {
  if (rate >= 0.9) return 'text-success'
  if (rate >= 0.7) return 'text-warning'
  return 'text-destructive'
}

function SummaryValue(props: {
  label: string
  value: ReactNode
  valueClassName?: string
}) {
  return (
    <div className='flex min-h-20 flex-col justify-center gap-1 px-4 py-3'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span
        className={cn(
          'font-mono text-xl font-semibold tabular-nums',
          props.valueClassName
        )}
      >
        {props.value}
      </span>
    </div>
  )
}

function FailureCategoryBadges(props: {
  category: ChannelMonitorFailureCategory
}) {
  const hasIdentity =
    props.category.status_code > 0 ||
    props.category.error_type !== '' ||
    props.category.error_code !== ''
  if (!hasIdentity) {
    return <Badge variant='outline'>其他错误</Badge>
  }
  return (
    <div className='flex max-w-72 flex-wrap gap-1'>
      {props.category.status_code > 0 ? (
        <Badge variant='outline'>HTTP {props.category.status_code}</Badge>
      ) : null}
      {props.category.error_code ? (
        <Badge
          variant='secondary'
          className='max-w-64'
          title={props.category.error_code}
        >
          <span className='truncate'>{props.category.error_code}</span>
        </Badge>
      ) : null}
      {props.category.error_type ? (
        <Badge
          variant='outline'
          className='max-w-64'
          title={props.category.error_type}
        >
          <span className='truncate'>{props.category.error_type}</span>
        </Badge>
      ) : null}
    </div>
  )
}

export function ChannelMonitorSuccessDetailDialog(
  props: ChannelMonitorSuccessDetailDialogProps
) {
  const query = useQuery({
    queryKey: [
      'channel-monitor-success-detail',
      props.rangeMinutes,
      props.target.scope,
      props.target.scope === 'channel'
        ? props.target.channelId
        : props.target.groupName,
      props.target.scope === 'channel' ? props.target.modelName : undefined,
    ],
    queryFn: () => {
      if (props.target.scope === 'channel') {
        return getChannelMonitorSuccessDetail({
          minutes: props.rangeMinutes,
          channelId: props.target.channelId,
          modelName: props.target.modelName,
        })
      }
      return getChannelMonitorSuccessDetail({
        minutes: props.rangeMinutes,
        groupName: props.target.groupName,
      })
    },
  })
  const detail = query.data?.data.detail
  const modeSummary = detail
    ? getModeSummary(detail.summary, props.target.mode)
    : null
  const groupChannelRows = useMemo(() => {
    if (props.target.scope !== 'group') return []
    const groupName = props.target.groupName
    const metricByChannel = new Map(
      (detail?.channel_items ?? []).map((metric) => [metric.channel_id, metric])
    )
    const channelById = new Map(
      props.channels.map((channel) => [channel.id, channel])
    )
    const channelIds = new Set(
      props.channels
        .filter((channel) => channel.groups.includes(groupName))
        .map((channel) => channel.id)
    )
    for (const metric of detail?.channel_items ?? []) {
      channelIds.add(metric.channel_id)
    }
    return [...channelIds]
      .map((channelId) => ({
        channelId,
        channel: channelById.get(channelId) ?? null,
        metric: metricByChannel.get(channelId) ?? null,
      }))
      .sort((first, second) => {
        const firstEnabled = first.channel?.status === CHANNEL_STATUS.ENABLED
        const secondEnabled = second.channel?.status === CHANNEL_STATUS.ENABLED
        if (firstEnabled !== secondEnabled) return firstEnabled ? -1 : 1
        const firstName = first.channel?.name ?? `渠道 ${first.channelId}`
        const secondName = second.channel?.name ?? `渠道 ${second.channelId}`
        const nameOrder = firstName.localeCompare(secondName)
        return nameOrder !== 0 ? nameOrder : first.channelId - second.channelId
      })
  }, [detail?.channel_items, props.channels, props.target])
  const failureCategories = useMemo(() => {
    if (!detail || props.target.scope !== 'channel') return []
    return (detail.failure_categories ?? []).filter((category) => {
      if (props.target.mode === 'final') return category.final_count > 0
      return category.actual_count > 0
    })
  }, [detail, props.target])

  const modeLabel =
    props.target.mode === 'actual' ? '真实调用口径' : '最终结果口径'
  let title = ''
  let description = `${props.rangeLabel} · ${modeLabel}`
  if (props.target.scope === 'channel') {
    title = `${props.target.channelName} 成功率明细`
    if (props.target.modelName) {
      description += ` · 模型 ${props.target.modelName}`
    }
  } else {
    title = `${props.target.groupName} 分组成功率明细`
  }

  let content: ReactNode
  if (query.isLoading) {
    content = (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  } else if (query.isError) {
    content = (
      <Empty className='min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>成功率明细加载失败</EmptyTitle>
          <EmptyDescription>网络或服务暂时不可用</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            type='button'
            variant='outline'
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <HugeiconsIcon icon={Refresh01Icon} data-icon='inline-start' />
            重新加载
          </Button>
        </EmptyContent>
      </Empty>
    )
  } else if (!query.data?.data.success_metrics_available) {
    content = (
      <Empty className='min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>成功率统计不可用</EmptyTitle>
          <EmptyDescription>需要同时开启消费日志和错误日志</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (!detail || !modeSummary || modeSummary.sampleCount <= 0) {
    content = (
      <Empty className='min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={Analytics01Icon} />
          </EmptyMedia>
          <EmptyTitle>暂无成功率样本</EmptyTitle>
          <EmptyDescription>当前时间范围内没有可统计的请求</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = (
      <div className='flex min-h-0 flex-col gap-4 overflow-y-auto pr-1'>
        <div className='grid shrink-0 grid-cols-1 divide-y rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
          <SummaryValue
            label={props.target.mode === 'actual' ? '成功调用' : '最终成功'}
            value={`${modeSummary.successCount} 次`}
            valueClassName='text-success'
          />
          <SummaryValue
            label={props.target.mode === 'actual' ? '失败调用' : '最终失败'}
            value={`${modeSummary.failureCount} 次`}
            valueClassName={
              modeSummary.failureCount > 0 ? 'text-destructive' : undefined
            }
          />
          <SummaryValue
            label={
              props.target.mode === 'actual'
                ? '真实调用成功率'
                : '最终结果成功率'
            }
            value={percentFormatter.format(modeSummary.successRate)}
            valueClassName={getRateClassName(modeSummary.successRate)}
          />
        </div>

        {props.target.scope === 'group' ? (
          <div className='flex flex-col gap-2'>
            <h3 className='font-medium'>渠道明细</h3>
            <div className='overflow-hidden rounded-lg border'>
              <Table className='min-w-[680px]'>
                <TableHeader>
                  <TableRow>
                    <TableHead>渠道</TableHead>
                    <TableHead className='text-right'>成功</TableHead>
                    <TableHead className='text-right'>失败</TableHead>
                    <TableHead className='text-right'>样本</TableHead>
                    <TableHead className='text-right'>成功率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupChannelRows.map((row) => {
                    const rowSummary = row.metric
                      ? getModeSummary(row.metric, props.target.mode)
                      : null
                    const channelEnabled =
                      row.channel?.status === CHANNEL_STATUS.ENABLED
                    return (
                      <TableRow key={row.channelId}>
                        <TableCell>
                          <div className='flex min-w-48 flex-col gap-0.5'>
                            <div className='flex items-center gap-2'>
                              <span className='font-medium'>
                                {row.channel?.name ?? `渠道 #${row.channelId}`}
                              </span>
                              {row.channel ? (
                                <Badge
                                  variant={
                                    channelEnabled ? 'secondary' : 'outline'
                                  }
                                >
                                  {channelEnabled ? '已启用' : '已停用'}
                                </Badge>
                              ) : null}
                            </div>
                            <span className='text-muted-foreground text-xs'>
                              ID {row.channelId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className='text-right font-mono'>
                          {rowSummary?.successCount ?? 0}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono',
                            rowSummary &&
                              rowSummary.failureCount > 0 &&
                              'text-destructive'
                          )}
                        >
                          {rowSummary?.failureCount ?? 0}
                        </TableCell>
                        <TableCell className='text-right font-mono'>
                          {rowSummary?.sampleCount ?? 0}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono font-semibold',
                            rowSummary && rowSummary.sampleCount > 0
                              ? getRateClassName(rowSummary.successRate)
                              : 'text-muted-foreground'
                          )}
                        >
                          {rowSummary && rowSummary.sampleCount > 0
                            ? percentFormatter.format(rowSummary.successRate)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className='flex flex-col gap-2'>
            <h3 className='font-medium'>失败报错分类</h3>
            {failureCategories.length === 0 ? (
              <Empty className='min-h-40 rounded-lg border'>
                <EmptyHeader>
                  <EmptyTitle>没有失败报错</EmptyTitle>
                  <EmptyDescription>
                    当前统计范围内未记录失败调用
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className='overflow-hidden rounded-lg border'>
                <Table className='min-w-[860px]'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>错误分类</TableHead>
                      <TableHead>示例报错</TableHead>
                      <TableHead className='text-right'>失败次数</TableHead>
                      <TableHead className='text-right'>失败占比</TableHead>
                      <TableHead>最近发生</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failureCategories.map((category) => {
                      const failureCount =
                        props.target.mode === 'final'
                          ? category.final_count
                          : category.actual_count
                      const ratio = failureCount / modeSummary.failureCount
                      return (
                        <TableRow
                          key={`${category.channel_id}:${category.status_code}:${category.error_type}:${category.error_code}:${category.sample_content}`}
                        >
                          <TableCell>
                            <FailureCategoryBadges category={category} />
                          </TableCell>
                          <TableCell>
                            <p
                              className='line-clamp-2 max-w-[30rem] break-words whitespace-normal'
                              title={category.sample_content}
                            >
                              {category.sample_content || '未记录错误内容'}
                            </p>
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex flex-col items-end gap-0.5 font-mono'>
                              <span className='font-semibold'>
                                {failureCount} 次
                              </span>
                              {category.actual_count !==
                              category.final_count ? (
                                <span className='text-muted-foreground text-xs'>
                                  最终失败 {category.final_count} 次
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className='text-right font-mono'>
                            {percentFormatter.format(ratio)}
                          </TableCell>
                          <TableCell>
                            {category.last_occurred_at > 0
                              ? formatTimestampToDate(category.last_occurred_at)
                              : '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-4xl'>
        <DialogHeader className='shrink-0 pr-10'>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
