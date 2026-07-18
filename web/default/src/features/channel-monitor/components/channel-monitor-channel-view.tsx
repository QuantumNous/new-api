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
  CloudDownloadIcon,
  Edit02Icon,
  HistoryIcon,
  Layers01Icon,
  PowerOffIcon,
  PowerServiceIcon,
  Settings02Icon,
  TestTubeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CHANNEL_STATUS,
  CHANNEL_STATUS_CONFIG,
} from '@/features/channels/constants'
import { formatTimestampToDate } from '@/lib/format'

import {
  CHANNEL_MONITOR_STATUS_LABELS,
  CHANNEL_MONITOR_UPSTREAM_TYPE_LABELS,
} from '../constants'
import { formatMonitorRatio } from '../lib/format'
import type {
  ChannelMonitorChannelPerformance,
  ChannelMonitorItem,
} from '../types'
import { ChannelMonitorFetchStatus } from './channel-monitor-fetch-status'
import {
  ChannelMonitorFirstTokenValue,
  ChannelMonitorTPSValue,
} from './channel-monitor-performance-value'
import { ChannelMonitorSmartScheduleCell } from './channel-monitor-smart-schedule-cell'
import { GroupRatioValue } from './group-ratio-value'
import { RatioChangeBadge } from './ratio-change-badge'

type ChannelMonitorChannelViewProps = {
  channels: ChannelMonitorItem[]
  groupRatios: Record<string, number>
  groupCoefficients: Record<string, number>
  performanceByChannel: Map<number, ChannelMonitorChannelPerformance>
  performanceRangeLabel: string
  performanceLoading: boolean
  performanceError: boolean
  onFetchUpstream: (channel: ChannelMonitorItem) => void
  onToggleStatus: (channel: ChannelMonitorItem) => void
  onTestConnection: (channel: ChannelMonitorItem) => void
  onEditRatio: (channel: ChannelMonitorItem) => void
  onEditGroups: (channel: ChannelMonitorItem) => void
  onConfigureUpstream: (channel: ChannelMonitorItem) => void
  onViewHistory: (channel: ChannelMonitorItem) => void
  onUpdateSmartSchedule: (
    channel: ChannelMonitorItem,
    excluded: boolean,
    group: string
  ) => void
  smartScheduleEnabled: boolean
  fetchingChannelId: number | null
  updatingStatusChannelId: number | null
  updatingSmartScheduleChannelId: number | null
}

type ChannelActionButtonProps = {
  label: string
  icon: React.ComponentProps<typeof HugeiconsIcon>['icon']
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
}

type ChannelPerformanceCellProps = {
  performance: ChannelMonitorChannelPerformance | undefined
  loading: boolean
  error: boolean
}

function ChannelActionButton(props: ChannelActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={props.onClick}
            disabled={props.disabled}
            aria-label={props.label}
            className={props.className}
          >
            {props.loading ? <Spinner /> : <HugeiconsIcon icon={props.icon} />}
          </Button>
        }
      />
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}

function ChannelPerformanceCell(props: ChannelPerformanceCellProps) {
  if (props.loading) {
    return <Skeleton className='h-9 w-28' />
  }
  if (props.error) {
    return <span className='text-destructive text-xs'>加载失败</span>
  }
  if (!props.performance) {
    return <span className='text-muted-foreground text-xs'>暂无样本</span>
  }
  return (
    <div className='flex min-w-32 flex-col gap-0.5 text-xs'>
      <div className='flex items-baseline gap-1.5'>
        <span className='text-muted-foreground'>首字</span>
        <ChannelMonitorFirstTokenValue
          value={props.performance.average_first_token_ms}
        />
      </div>
      <div className='flex items-baseline gap-1.5'>
        <span className='text-muted-foreground'>TPS</span>
        <ChannelMonitorTPSValue value={props.performance.average_tps} />
      </div>
      <span className='text-muted-foreground'>
        {props.performance.sample_count} 次请求
      </span>
    </div>
  )
}

export function ChannelMonitorChannelView(
  props: ChannelMonitorChannelViewProps
) {
  if (props.channels.length === 0) {
    return (
      <Empty className='min-h-72'>
        <EmptyHeader>
          <EmptyTitle>当前筛选下没有渠道</EmptyTitle>
          <EmptyDescription>切换上游类型或调整搜索条件</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <Table
        className={
          props.smartScheduleEnabled ? 'min-w-[1560px]' : 'min-w-[1280px]'
        }
      >
        <TableHeader>
          <TableRow>
            <TableHead>渠道</TableHead>
            <TableHead>上游倍率</TableHead>
            <TableHead>倍率更新状态</TableHead>
            <TableHead>关联分组</TableHead>
            <TableHead>性能（{props.performanceRangeLabel}）</TableHead>
            {props.smartScheduleEnabled ? (
              <TableHead>智能调度</TableHead>
            ) : null}
            <TableHead>更新时间</TableHead>
            <TableHead className='w-40 text-right'>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.channels.map((channel) => {
            const statusConfig =
              CHANNEL_STATUS_CONFIG[
                channel.status as keyof typeof CHANNEL_STATUS_CONFIG
              ] ?? CHANNEL_STATUS_CONFIG[0]
            return (
              <TableRow key={channel.id}>
                <TableCell>
                  <div className='flex min-w-44 flex-wrap items-center gap-2'>
                    <div className='flex min-w-0 flex-col gap-0.5'>
                      <span className='truncate font-medium'>
                        {channel.name}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        ID {channel.id}
                      </span>
                    </div>
                    <StatusBadge
                      label={
                        CHANNEL_MONITOR_STATUS_LABELS[channel.status] ?? '未知'
                      }
                      variant={statusConfig.variant}
                      copyable={false}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex min-w-32 items-center gap-2'>
                    <span className='font-mono text-base font-semibold'>
                      {formatMonitorRatio(channel.ratio)}
                    </span>
                    <RatioChangeBadge
                      current={channel.ratio}
                      previous={channel.previous_ratio}
                    />
                    {channel.upstream && (
                      <Badge variant='secondary'>
                        {
                          CHANNEL_MONITOR_UPSTREAM_TYPE_LABELS[
                            channel.upstream.type
                          ]
                        }
                      </Badge>
                    )}
                  </div>
                  {channel.upstream && (
                    <div className='text-muted-foreground mt-0.5 text-xs'>
                      上游分组：{channel.upstream.group}
                    </div>
                  )}
                </TableCell>
                <TableCell className='min-w-72 whitespace-normal'>
                  <ChannelMonitorFetchStatus channel={channel} />
                </TableCell>
                <TableCell className='min-w-52 whitespace-normal'>
                  {channel.groups.length === 0 ? (
                    <span className='text-muted-foreground'>-</span>
                  ) : (
                    <div className='flex flex-wrap gap-1.5'>
                      {channel.groups.map((group) => {
                        const groupRatio = props.groupRatios[group] ?? 1
                        const coefficient = props.groupCoefficients[group] ?? 1
                        return (
                          <Badge key={group} variant='outline'>
                            {group} ×{' '}
                            <GroupRatioValue
                              groupRatio={groupRatio}
                              upstreamRatio={channel.ratio}
                              coefficient={coefficient}
                            />
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <ChannelPerformanceCell
                    performance={props.performanceByChannel.get(channel.id)}
                    loading={props.performanceLoading}
                    error={props.performanceError}
                  />
                </TableCell>
                {props.smartScheduleEnabled ? (
                  <TableCell className='min-w-72 whitespace-normal'>
                    <ChannelMonitorSmartScheduleCell
                      channel={channel}
                      enabled={props.smartScheduleEnabled}
                      pending={
                        props.updatingSmartScheduleChannelId === channel.id
                      }
                      onUpdate={(excluded, group) =>
                        props.onUpdateSmartSchedule(channel, excluded, group)
                      }
                    />
                  </TableCell>
                ) : null}
                <TableCell>
                  {channel.updated_time > 0 ? (
                    <div className='flex min-w-36 flex-col gap-0.5'>
                      <span>{formatTimestampToDate(channel.updated_time)}</span>
                      {channel.updated_by_username && (
                        <span className='text-muted-foreground text-xs'>
                          {channel.updated_by_username}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className='text-muted-foreground'>-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className='flex min-w-max justify-end gap-0.5'>
                    <ChannelActionButton
                      label={
                        channel.status === CHANNEL_STATUS.ENABLED
                          ? '禁用渠道'
                          : '启用渠道'
                      }
                      icon={
                        channel.status === CHANNEL_STATUS.ENABLED
                          ? PowerOffIcon
                          : PowerServiceIcon
                      }
                      onClick={() => props.onToggleStatus(channel)}
                      disabled={props.updatingStatusChannelId !== null}
                      loading={props.updatingStatusChannelId === channel.id}
                      className={
                        channel.status === CHANNEL_STATUS.ENABLED
                          ? 'text-destructive hover:text-destructive'
                          : 'text-success hover:text-success'
                      }
                    />
                    <ChannelActionButton
                      label='测试连接'
                      icon={TestTubeIcon}
                      onClick={() => props.onTestConnection(channel)}
                    />
                    {channel.upstream && (
                      <ChannelActionButton
                        label='获取并记录倍率'
                        icon={CloudDownloadIcon}
                        onClick={() => props.onFetchUpstream(channel)}
                        disabled={props.fetchingChannelId !== null}
                        loading={props.fetchingChannelId === channel.id}
                      />
                    )}
                    <ChannelActionButton
                      label={
                        channel.ratio == null ? '记录渠道倍率' : '修改渠道倍率'
                      }
                      icon={Edit02Icon}
                      onClick={() => props.onEditRatio(channel)}
                    />
                    <ChannelActionButton
                      label='更改关联分组'
                      icon={Layers01Icon}
                      onClick={() => props.onEditGroups(channel)}
                    />
                    <ChannelActionButton
                      label={channel.upstream ? '编辑上游配置' : '配置上游'}
                      icon={Settings02Icon}
                      onClick={() => props.onConfigureUpstream(channel)}
                    />
                    <ChannelActionButton
                      label='倍率变更历史'
                      icon={HistoryIcon}
                      onClick={() => props.onViewHistory(channel)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
