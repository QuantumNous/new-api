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
  Edit02Icon,
  Refresh01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo } from 'react'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
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
import { CHANNEL_STATUS } from '@/features/channels/constants'
import { cn } from '@/lib/utils'

import { formatMonitorRatio, getChannelGroupTargetRatio } from '../lib/format'
import type {
  ChannelMonitorGroupSuccessMetric,
  GroupMonitorItem,
} from '../types'
import { ChannelMonitorSuccessRateValue } from './channel-monitor-success-rate-value'

type ChannelMonitorGroupViewProps = {
  groups: GroupMonitorItem[]
  successByGroup: Map<string, ChannelMonitorGroupSuccessMetric>
  successMetricsAvailable: boolean
  successLoading: boolean
  successError: boolean
  successRangeLabel: string
  onOpenSuccessDetail: (
    group: GroupMonitorItem,
    mode: 'actual' | 'final'
  ) => void
  onOpenScheduleSettings: () => void
  onEditGroup: (group: GroupMonitorItem) => void
  onSyncGroup: (group: GroupMonitorItem) => void
}

export function ChannelMonitorGroupView(props: ChannelMonitorGroupViewProps) {
  const groupsWithSortedChannels = useMemo(
    () =>
      props.groups
        .map((group) => ({
          group,
          channels: [...group.channels].sort((leftChannel, rightChannel) => {
            const leftEnabled = leftChannel.status === CHANNEL_STATUS.ENABLED
            const rightEnabled = rightChannel.status === CHANNEL_STATUS.ENABLED
            if (leftEnabled !== rightEnabled) return leftEnabled ? -1 : 1

            const leftRatio =
              leftChannel.cost_ratio != null &&
              Number.isFinite(leftChannel.cost_ratio)
                ? leftChannel.cost_ratio
                : null
            const rightRatio =
              rightChannel.cost_ratio != null &&
              Number.isFinite(rightChannel.cost_ratio)
                ? rightChannel.cost_ratio
                : null

            if (leftRatio != null && rightRatio != null) {
              const ratioOrder = leftRatio - rightRatio
              if (ratioOrder !== 0) return ratioOrder
            } else if (leftRatio != null) {
              return -1
            } else if (rightRatio != null) {
              return 1
            }

            const nameOrder = leftChannel.name.localeCompare(rightChannel.name)
            return nameOrder !== 0
              ? nameOrder
              : leftChannel.id - rightChannel.id
          }),
        }))
        .sort((leftGroup, rightGroup) => {
          const ratioOrder = leftGroup.group.ratio - rightGroup.group.ratio
          if (ratioOrder !== 0) return ratioOrder
          return leftGroup.group.name.localeCompare(rightGroup.group.name)
        }),
    [props.groups]
  )

  if (props.groups.length === 0) {
    return (
      <Empty className='min-h-72'>
        <EmptyHeader>
          <EmptyTitle>没有匹配的分组</EmptyTitle>
          <EmptyDescription>换个关键词试试</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-3'>
      <Alert className='pr-28'>
        <AlertTitle>智能调度设置</AlertTitle>
        <AlertDescription>
          所有分组统一使用智能调度中选择的调度方式和统计规则。
        </AlertDescription>
        <AlertAction>
          <Button
            variant='outline'
            size='sm'
            onClick={props.onOpenScheduleSettings}
          >
            <HugeiconsIcon icon={Settings02Icon} data-icon='inline-start' />
            统计设置
          </Button>
        </AlertAction>
      </Alert>

      <div className='overflow-hidden rounded-lg border'>
        <Table className='min-w-[1160px]'>
          <TableHeader>
            <TableRow>
              <TableHead>分组</TableHead>
              <TableHead>分组倍率</TableHead>
              <TableHead
                className='whitespace-normal'
                title='成功调用数除以全部真实上游调用数，包含重试过程'
              >
                真实调用成功率（{props.successRangeLabel}）
              </TableHead>
              <TableHead
                className='whitespace-normal'
                title='排除重试过程中的中间失败，只统计最终返回结果'
              >
                最终结果成功率（{props.successRangeLabel}）
              </TableHead>
              <TableHead>关联渠道与成本倍率</TableHead>
              <TableHead className='w-24 text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupsWithSortedChannels.map((groupEntry) => {
              const group = groupEntry.group
              const successMetric = props.successByGroup.get(group.name)
              const enabledChannelCount = group.channels.filter(
                (channel) => channel.status === CHANNEL_STATUS.ENABLED
              ).length
              let highestTargetRatio: number | null = null
              for (const channel of group.channels) {
                if (channel.status !== CHANNEL_STATUS.ENABLED) continue
                const targetRatio = getChannelGroupTargetRatio(
                  channel.cost_ratio,
                  group.coefficient
                )
                if (
                  targetRatio != null &&
                  (highestTargetRatio == null ||
                    targetRatio > highestTargetRatio)
                ) {
                  highestTargetRatio = targetRatio
                }
              }
              let groupRatioClassName = 'text-foreground'
              if (highestTargetRatio != null) {
                if (Math.abs(group.ratio - highestTargetRatio) <= 1e-9) {
                  groupRatioClassName = 'text-amber-600 dark:text-amber-400'
                } else if (group.ratio < highestTargetRatio) {
                  groupRatioClassName = 'text-destructive'
                } else {
                  groupRatioClassName = 'text-emerald-600 dark:text-emerald-400'
                }
              }
              return (
                <TableRow key={group.name}>
                  <TableCell>
                    <div className='flex min-w-36 flex-col gap-0.5'>
                      <span className='font-medium'>{group.name}</span>
                      <span className='text-muted-foreground text-xs'>
                        {group.channels.length} 个渠道 · {enabledChannelCount}{' '}
                        个启用
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex min-w-28 flex-col gap-0.5'>
                      <span
                        className={`font-mono font-semibold ${groupRatioClassName}`}
                      >
                        {formatMonitorRatio(group.ratio)}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        系数 × {formatMonitorRatio(group.coefficient)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChannelMonitorSuccessRateValue
                      rate={successMetric?.actual_success_rate}
                      successCount={successMetric?.actual_success_count}
                      sampleCount={successMetric?.actual_sample_count}
                      available={props.successMetricsAvailable}
                      loading={props.successLoading}
                      error={props.successError}
                      onClick={() => props.onOpenSuccessDetail(group, 'actual')}
                      detailLabel={`查看 ${group.name} 分组的真实调用成功率明细`}
                    />
                  </TableCell>
                  <TableCell>
                    <ChannelMonitorSuccessRateValue
                      rate={successMetric?.final_success_rate}
                      successCount={successMetric?.final_success_count}
                      sampleCount={successMetric?.final_sample_count}
                      available={props.successMetricsAvailable}
                      loading={props.successLoading}
                      error={props.successError}
                      onClick={() => props.onOpenSuccessDetail(group, 'final')}
                      detailLabel={`查看 ${group.name} 分组的最终结果成功率明细`}
                    />
                  </TableCell>
                  <TableCell className='min-w-72 whitespace-normal'>
                    {group.channels.length === 0 ? (
                      <span className='text-muted-foreground'>-</span>
                    ) : (
                      <div className='flex max-h-36 flex-wrap content-start gap-1.5 overflow-y-auto overscroll-contain py-0.5 pr-1'>
                        {groupEntry.channels.map((channel) => {
                          const channelEnabled =
                            channel.status === CHANNEL_STATUS.ENABLED
                          const ratio = formatMonitorRatio(channel.cost_ratio)
                          const upstreamRatio = formatMonitorRatio(
                            channel.ratio
                          )
                          const conversionFactor = formatMonitorRatio(
                            channel.conversion_factor
                          )

                          return (
                            <Badge
                              key={channel.id}
                              variant={channelEnabled ? 'secondary' : 'outline'}
                              className='max-w-56'
                              title={`${channel.name}：成本倍率 ${ratio}（上游 ${upstreamRatio} × 换算 ${conversionFactor}）`}
                            >
                              <span
                                className={cn(
                                  'max-w-32 truncate',
                                  !channelEnabled &&
                                    'text-muted-foreground line-through'
                                )}
                              >
                                {channel.name}
                              </span>
                              <span aria-hidden='true'>×</span>
                              <span className='shrink-0 font-mono tabular-nums'>
                                {ratio}
                              </span>
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end gap-0.5'>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              onClick={() => props.onSyncGroup(group)}
                              aria-label='按最高成本倍率更新'
                            >
                              <HugeiconsIcon icon={Refresh01Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>按最高成本倍率更新</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              onClick={() => props.onEditGroup(group)}
                              aria-label='修改分组倍率'
                            >
                              <HugeiconsIcon icon={Edit02Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>修改分组倍率</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
