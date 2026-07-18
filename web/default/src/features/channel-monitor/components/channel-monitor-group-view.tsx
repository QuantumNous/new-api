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

import { formatMonitorRatio, getChannelGroupTargetRatio } from '../lib/format'
import type { GroupMonitorItem } from '../types'
import { ChannelMonitorFetchStatus } from './channel-monitor-fetch-status'

type ChannelMonitorGroupViewProps = {
  groups: GroupMonitorItem[]
  onOpenScheduleSettings: () => void
  onEditGroup: (group: GroupMonitorItem) => void
  onSyncGroup: (group: GroupMonitorItem) => void
}

export function ChannelMonitorGroupView(props: ChannelMonitorGroupViewProps) {
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分组</TableHead>
              <TableHead>分组倍率</TableHead>
              <TableHead>关联渠道与上游倍率</TableHead>
              <TableHead className='w-24 text-right'>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.groups.map((group) => {
              const enabledChannelCount = group.channels.filter(
                (channel) => channel.status === CHANNEL_STATUS.ENABLED
              ).length
              const scheduledChannelCount = group.channels.filter((channel) => {
                if (channel.smart_schedule_excluded) return false
                if (channel.smart_schedule_group) {
                  return channel.smart_schedule_group === group.name
                }
                return channel.groups.length === 1
              }).length
              let highestTargetRatio: number | null = null
              for (const channel of group.channels) {
                if (channel.status !== CHANNEL_STATUS.ENABLED) continue
                const targetRatio = getChannelGroupTargetRatio(
                  channel.ratio,
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
                        个启用 · {scheduledChannelCount} 个参与调度
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
                  <TableCell className='min-w-80 whitespace-normal'>
                    {group.channels.length === 0 ? (
                      <span className='text-muted-foreground'>-</span>
                    ) : (
                      <div className='grid gap-1.5 lg:grid-cols-2'>
                        {group.channels.map((channel) => {
                          return (
                            <div
                              key={channel.id}
                              className='bg-muted/40 flex min-w-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5'
                            >
                              <span className='truncate text-sm'>
                                {channel.name}
                              </span>
                              <span className='flex items-center gap-2'>
                                <ChannelMonitorFetchStatus channel={channel} />
                                {channel.status !== CHANNEL_STATUS.ENABLED && (
                                  <Badge variant='outline'>已禁用</Badge>
                                )}
                                <span className='font-mono text-sm font-medium'>
                                  {formatMonitorRatio(channel.ratio)}
                                </span>
                              </span>
                            </div>
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
                              aria-label='按最高上游倍率更新'
                            >
                              <HugeiconsIcon icon={Refresh01Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>按最高上游倍率更新</TooltipContent>
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
