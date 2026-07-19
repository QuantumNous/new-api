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
import { HistoryIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Empty,
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
import { formatTimestampToDate } from '@/lib/format'

import { getChannelMonitorHistory } from '../api'
import { formatChangePercent, formatMonitorRatio } from '../lib/format'
import type { ChannelMonitorItem } from '../types'

type ChannelRatioHistoryPanelProps = {
  channel: ChannelMonitorItem
}

type ChannelRatioHistoryDialogProps = ChannelRatioHistoryPanelProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelRatioHistoryDialog(
  props: ChannelRatioHistoryDialogProps
) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-hidden sm:max-w-4xl'>
        <DialogHeader className='pr-10'>
          <DialogTitle>上游倍率变更历史</DialogTitle>
          <DialogDescription>
            {props.channel.name} · ID {props.channel.id}
          </DialogDescription>
        </DialogHeader>
        <ChannelRatioHistoryPanel channel={props.channel} />
      </DialogContent>
    </Dialog>
  )
}

export function ChannelRatioHistoryPanel(props: ChannelRatioHistoryPanelProps) {
  const query = useQuery({
    queryKey: ['channel-monitor-history', props.channel.id],
    queryFn: () => getChannelMonitorHistory(props.channel.id),
  })
  const history = query.data?.data.items ?? []

  let historyContent: ReactNode
  if (query.isLoading) {
    historyContent = (
      <div className='flex flex-col gap-3 p-4'>
        {['first', 'second', 'third', 'fourth'].map((key) => (
          <Skeleton key={key} className='h-12 w-full' />
        ))}
      </div>
    )
  } else if (history.length === 0) {
    historyContent = (
      <Empty className='min-h-64 border-0'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={HistoryIcon} />
          </EmptyMedia>
          <EmptyTitle>暂无上游倍率变更</EmptyTitle>
          <EmptyDescription>
            首次记录作为基准值，倍率发生变化后才会生成历史。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    historyContent = (
      <Table className='min-w-[680px]'>
        <TableHeader>
          <TableRow>
            <TableHead>时间</TableHead>
            <TableHead>上游倍率变更</TableHead>
            <TableHead>操作人</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) => {
            const percent =
              item.old_ratio === 0
                ? null
                : ((item.new_ratio - item.old_ratio) / item.old_ratio) * 100
            return (
              <TableRow key={item.id}>
                <TableCell>
                  {formatTimestampToDate(item.created_time)}
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2 font-mono'>
                    <span>{formatMonitorRatio(item.old_ratio)}</span>
                    <span className='text-muted-foreground'>→</span>
                    <span className='font-semibold'>
                      {formatMonitorRatio(item.new_ratio)}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {formatChangePercent(percent)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.operator_username || `#${item.operator_id}`}
                </TableCell>
                <TableCell className='max-w-64 truncate' title={item.remark}>
                  {item.remark || '-'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className='min-h-0 overflow-auto rounded-lg border'>
      {historyContent}
    </div>
  )
}
