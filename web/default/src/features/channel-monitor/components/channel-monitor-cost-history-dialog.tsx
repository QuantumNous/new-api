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
import { ChartLineData01Icon, MoneyBag02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import { useMemo, useState, type ReactNode } from 'react'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import { getChannelMonitorCostOverview } from '../api'
import { formatChannelMonitorCost } from '../lib/format'
import type { ChannelMonitorCostOverview } from '../types'

const COST_HISTORY_RANGE_OPTIONS = [
  { value: '7', label: '近 7 天' },
  { value: '30', label: '近 30 天' },
  { value: '90', label: '近 90 天' },
]

type ChannelMonitorCostHistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelMonitorCostHistoryDialog(
  props: ChannelMonitorCostHistoryDialogProps
) {
  const [days, setDays] = useState(30)
  const query = useQuery({
    queryKey: ['channel-monitor', 'cost', days],
    queryFn: () => getChannelMonitorCostOverview(days),
    enabled: props.open,
    staleTime: 30_000,
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-hidden sm:max-w-5xl'>
        <DialogHeader className='pr-10'>
          <DialogTitle>渠道成本</DialogTitle>
          <DialogDescription>
            按北京时间、当前渠道成本倍率和本地分组倍率估算；消费增加、退款按发生日抵减，调整倍率后历史金额会同步变化。
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 overflow-auto pr-1'>
          <div className='flex flex-col gap-4 pb-1'>
            <div className='flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between'>
              <CostSummary
                overview={query.data?.data}
                loading={query.isLoading}
              />
              <Select
                items={COST_HISTORY_RANGE_OPTIONS}
                value={String(days)}
                onValueChange={(value) => {
                  switch (value) {
                    case '7':
                      setDays(7)
                      break
                    case '30':
                      setDays(30)
                      break
                    case '90':
                      setDays(90)
                      break
                  }
                }}
              >
                <SelectTrigger
                  className='w-full sm:w-32'
                  aria-label='成本统计时间范围'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {COST_HISTORY_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <CostHistoryContent
              loading={query.isLoading}
              error={query.isError}
              overview={query.data?.data}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CostSummary(props: {
  overview: ChannelMonitorCostOverview | undefined
  loading: boolean
}) {
  if (props.loading) {
    return <Skeleton className='h-16 w-full sm:w-96' />
  }

  return (
    <div className='grid min-w-0 grid-cols-3 gap-4 sm:gap-8'>
      <CostSummaryValue
        label='今日成本'
        value={props.overview?.today_cost_cny}
      />
      <CostSummaryValue
        label='昨日成本'
        value={props.overview?.yesterday_cost_cny}
      />
      <CostSummaryValue
        label='区间累计'
        value={props.overview?.total_cost_cny}
      />
    </div>
  )
}

function CostSummaryValue(props: { label: string; value: number | undefined }) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-muted-foreground text-xs'>{props.label}</span>
      <span className='truncate font-mono text-base font-semibold tabular-nums sm:text-lg'>
        {formatChannelMonitorCost(props.value)}
      </span>
    </div>
  )
}

function CostHistoryContent(props: {
  loading: boolean
  error: boolean
  overview: ChannelMonitorCostOverview | undefined
}) {
  let content: ReactNode
  if (props.loading) {
    content = (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-56 w-full' />
        <Skeleton className='h-48 w-full' />
      </div>
    )
  } else if (props.error || !props.overview) {
    content = (
      <Empty className='min-h-64 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={MoneyBag02Icon} />
          </EmptyMedia>
          <EmptyTitle>成本统计加载失败</EmptyTitle>
          <EmptyDescription>请稍后重试</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else if (props.overview.coverage.included_channel_count === 0) {
    content = (
      <Empty className='min-h-64 border'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <HugeiconsIcon icon={MoneyBag02Icon} />
          </EmptyMedia>
          <EmptyTitle>暂无可回算的成本</EmptyTitle>
          <EmptyDescription>
            为渠道配置充值或订阅换算并获取上游倍率后，消费日志将纳入成本统计。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = <CostHistoryData overview={props.overview} />
  }
  return content
}

function CostHistoryData(props: { overview: ChannelMonitorCostOverview }) {
  const { resolvedTheme, themeReady } = useChartTheme()
  const chartSpec = useMemo(
    () => ({
      type: 'bar' as const,
      data: [
        {
          id: 'channel-cost',
          values: props.overview.items.map((item) => ({
            date: item.date,
            cost: item.cost_cny,
          })),
        },
      ],
      xField: 'date',
      yField: 'cost',
      bar: {
        style: {
          cornerRadius: [4, 4, 0, 0],
        },
      },
      legends: { visible: false },
      tooltip: {
        mark: {
          title: { value: (datum: { date: string }) => datum.date },
          content: [
            {
              key: '预估成本',
              value: (datum: { cost: number }) =>
                formatChannelMonitorCost(datum.cost),
            },
          ],
        },
      },
      axes: [
        {
          orient: 'bottom',
          label: { autoHide: true },
          tick: { visible: false },
        },
        {
          orient: 'left',
          label: {
            formatMethod: (value: number | string) =>
              formatChannelMonitorCost(Number(value)),
          },
        },
      ],
    }),
    [props.overview.items]
  )

  const coverage = props.overview.coverage
  return (
    <div className='flex flex-col gap-4'>
      <div className='h-56 overflow-hidden rounded-md border sm:h-64'>
        {themeReady && (
          <VChart
            key={`${props.overview.days}:${resolvedTheme}`}
            spec={{
              ...chartSpec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
      <CostCoverage coverage={coverage} />
      <div className='overflow-auto rounded-md border'>
        <Table className='min-w-[480px]'>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead>
              <TableHead className='text-right'>预估成本</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...props.overview.items].reverse().map((item) => (
              <TableRow key={item.start_at}>
                <TableCell className='font-mono'>{item.date}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {formatChannelMonitorCost(item.cost_cny)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {props.overview.channels.length > 0 && (
        <div className='overflow-auto rounded-md border'>
          <Table className='min-w-[480px]'>
            <TableHeader>
              <TableRow>
                <TableHead>渠道</TableHead>
                <TableHead className='text-right'>区间预估成本</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.overview.channels.map((channel) => (
                <TableRow key={channel.channel_id}>
                  <TableCell className='max-w-72 truncate'>
                    {channel.channel_name}
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {formatChannelMonitorCost(channel.cost_cny)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function CostCoverage(props: {
  coverage: ChannelMonitorCostOverview['coverage']
}) {
  const values = [`已纳入 ${props.coverage.included_channel_count} 个渠道`]
  if (props.coverage.unresolved_channel_count > 0) {
    values.push(`暂无法回算 ${props.coverage.unresolved_channel_count} 个`)
  }
  if (props.coverage.free_group_channel_count > 0) {
    values.push(`免费分组未纳入 ${props.coverage.free_group_channel_count} 个`)
  }
  return (
    <div className='text-muted-foreground flex items-start gap-2 text-xs'>
      <HugeiconsIcon icon={ChartLineData01Icon} className='mt-0.5 shrink-0' />
      <span>{values.join('；')}</span>
    </div>
  )
}
