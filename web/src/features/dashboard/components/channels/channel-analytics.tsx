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
import { useQuery } from '@tanstack/react-query'
import { VChart } from '@visactor/react-vchart'
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Database,
  Gauge,
  Loader2,
  Radio,
  Sparkles,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useTheme } from '@/context/theme-provider'
import { CHANNEL_STATUS_CONFIG } from '@/features/channels/constants'
import { getChannelQuotaReportData } from '@/features/dashboard/api'
import { TIME_RANGE_PRESETS } from '@/features/dashboard/constants'
import { getDashboardChartColors } from '@/features/dashboard/lib/charts'
import type { ChannelQuotaReportItem } from '@/features/dashboard/types'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatChartTime, getRollingDateRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type ChartSpec = Record<string, unknown>

type ChannelAggregate = {
  id: number
  name: string
  status: number
  responseTime: number
  value: number
  quota: number
  tokens: number
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  cacheCreationTokens: number
  requests: number
  modelCount: number
  topModel: string
  topModelQuota: number
}

type ChannelSummary = {
  totalQuota: number
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCacheTokens: number
  totalCacheCreationTokens: number
  totalRequests: number
  activeChannels: number
  enabledChannels: number
  avgResponseTime: number
  topChannel?: ChannelAggregate
}

const TOP_CHANNEL_LIMIT = 10
const TOP_MODEL_LIMIT = 6

const HEALTHY_LATENCY_MS = 1500
const SLOW_LATENCY_MS = 5000
const HEALTH_SKELETON_ROWS = [
  'primary',
  'secondary',
  'tertiary',
  'backup',
  'overflow',
]
const ALL_FILTER_VALUE = '__all__'

type StatusFilter = typeof ALL_FILTER_VALUE | 'enabled' | 'disabled'
type ChannelMetric =
  | 'quota'
  | 'total_tokens'
  | 'prompt_tokens'
  | 'completion_tokens'
  | 'cache_tokens'
  | 'cache_creation_tokens'
  | 'requests'
type ChannelTrendView = 'trend' | 'bar'

type FilterOption = {
  value: string
  label: string
}

type TooltipRow = {
  key: string
  value: string | number
  datum?: Record<string, unknown>
}

function channelChartBucketTimestamp(timestamp: number, rangeDays: number) {
  const date = new Date(timestamp * 1000)
  if (rangeDays <= 1) {
    date.setMinutes(0, 0, 0)
  } else {
    date.setHours(0, 0, 0, 0)
  }
  return Math.floor(date.getTime() / 1000)
}

function formatInt(value: number): string {
  return Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value
  )
}

function channelLabel(item: ChannelQuotaReportItem): string {
  return item.channel_name || `channel-${item.channel_id}`
}

function channelStatusConfig(status: number) {
  return (
    CHANNEL_STATUS_CONFIG[status as keyof typeof CHANNEL_STATUS_CONFIG] ||
    CHANNEL_STATUS_CONFIG[0]
  )
}

function healthVariant(status: number, responseTime: number) {
  if (status !== 1) return 'danger' as const
  if (responseTime <= 0) return 'neutral' as const
  if (responseTime <= HEALTHY_LATENCY_MS) return 'success' as const
  if (responseTime <= SLOW_LATENCY_MS) return 'warning' as const
  return 'danger' as const
}

function healthLabelKey(status: number, responseTime: number): string {
  if (status !== 1) return 'Unavailable'
  if (responseTime <= 0) return 'Untested'
  if (responseTime <= HEALTHY_LATENCY_MS) return 'Healthy'
  if (responseTime <= SLOW_LATENCY_MS) return 'Slow'
  return 'Degraded'
}

function channelMetricValue(
  item: ChannelQuotaReportItem,
  metric: ChannelMetric
) {
  switch (metric) {
    case 'quota':
      return Number(item.quota) || 0
    case 'total_tokens':
      return Number(item.token_used) || 0
    case 'prompt_tokens':
      return Number(item.prompt_tokens) || 0
    case 'completion_tokens':
      return Number(item.completion_tokens) || 0
    case 'cache_tokens':
      return Number(item.cache_tokens) || 0
    case 'cache_creation_tokens':
      return Number(item.cache_creation_tokens) || 0
    case 'requests':
      return Number(item.count) || 0
  }
}

function formatMetricValue(metric: ChannelMetric, value: number): string {
  if (metric === 'quota') {
    return formatQuotaWithCurrency(value, {
      compact: true,
      digitsLarge: 2,
    })
  }
  return formatInt(value)
}

function formatDetailedQuota(value: number): string {
  return formatQuotaWithCurrency(value, {
    abbreviate: false,
    compact: false,
    digitsLarge: 4,
    digitsSmall: 6,
  })
}

function formatSummaryQuota(value: number): {
  value: string
  detailValue: string
} {
  const detailValue = formatDetailedQuota(value)
  if (detailValue.length <= 12) {
    return { value: detailValue, detailValue }
  }
  return {
    value: formatQuotaWithCurrency(value, {
      compact: true,
      digitsLarge: 2,
    }),
    detailValue,
  }
}

function formatTooltipDatum(
  metric: ChannelMetric,
  datum: Record<string, unknown>
) {
  return formatMetricValue(metric, Number(datum.value) || 0)
}

function formatTooltipRows(metric: ChannelMetric, rows: TooltipRow[]) {
  return rows.map((row) => ({
    ...row,
    value: row.datum ? formatTooltipDatum(metric, row.datum) : row.value,
  }))
}

function channelTokenSegments(
  channel: ChannelAggregate,
  t: (key: string) => string
) {
  return tokenSegments(
    channel.promptTokens,
    channel.completionTokens,
    channel.cacheTokens,
    channel.cacheCreationTokens,
    t
  )
}

function tokenSegments(
  promptTokens: number,
  completionTokens: number,
  cacheTokens: number,
  cacheCreationTokens: number,
  t: (key: string) => string
) {
  const cachedInput = Math.min(promptTokens, cacheTokens)
  const cacheCreation = Math.min(
    Math.max(promptTokens - cachedInput, 0),
    cacheCreationTokens
  )
  const input = Math.max(promptTokens - cachedInput - cacheCreation, 0)

  return [
    { tokenType: t('Input Tokens'), value: input },
    { tokenType: t('Cache Read Tokens'), value: cachedInput },
    { tokenType: t('Cache Write Tokens'), value: cacheCreation },
    { tokenType: t('Output Tokens'), value: completionTokens },
  ].filter((item) => item.value > 0)
}

function buildChannelAggregates(
  data: ChannelQuotaReportItem[],
  metric: ChannelMetric
) {
  const channelMap = new Map<
    number,
    ChannelAggregate & { models: Map<string, number> }
  >()

  data.forEach((item) => {
    const id = Number(item.channel_id) || 0
    if (id === 0) return

    let channel = channelMap.get(id)
    if (!channel) {
      channel = {
        id,
        name: channelLabel(item),
        status: Number(item.status) || 0,
        responseTime: Number(item.response_time) || 0,
        value: 0,
        quota: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cacheTokens: 0,
        cacheCreationTokens: 0,
        requests: 0,
        modelCount: 0,
        topModel: '',
        topModelQuota: 0,
        models: new Map<string, number>(),
      }
      channelMap.set(id, channel)
    }

    const quota = Number(item.quota) || 0
    const value = channelMetricValue(item, metric)
    const model = item.model_name || 'Unknown'
    channel.value += value
    channel.quota += quota
    channel.tokens += Number(item.token_used) || 0
    channel.promptTokens += Number(item.prompt_tokens) || 0
    channel.completionTokens += Number(item.completion_tokens) || 0
    channel.cacheTokens += Number(item.cache_tokens) || 0
    channel.cacheCreationTokens += Number(item.cache_creation_tokens) || 0
    channel.requests += Number(item.count) || 0
    channel.models.set(model, (channel.models.get(model) ?? 0) + value)
  })

  return [...channelMap.values()]
    .map((channel) => {
      let topModel = ''
      let topModelQuota = 0
      channel.models.forEach((quota, model) => {
        if (quota > topModelQuota) {
          topModel = model
          topModelQuota = quota
        }
      })

      return {
        id: channel.id,
        name: channel.name,
        status: channel.status,
        responseTime: channel.responseTime,
        value: channel.value,
        quota: channel.quota,
        tokens: channel.tokens,
        promptTokens: channel.promptTokens,
        completionTokens: channel.completionTokens,
        cacheTokens: channel.cacheTokens,
        cacheCreationTokens: channel.cacheCreationTokens,
        requests: channel.requests,
        modelCount: channel.models.size,
        topModel,
        topModelQuota,
      }
    })
    .sort((a, b) => b.value - a.value)
}

function buildSummary(channels: ChannelAggregate[]): ChannelSummary {
  const responseTimes = channels
    .map((channel) => channel.responseTime)
    .filter((value) => value > 0)
  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, value) => sum + value, 0) /
            responseTimes.length
        )
      : 0

  return {
    totalQuota: channels.reduce((sum, channel) => sum + channel.quota, 0),
    totalTokens: channels.reduce((sum, channel) => sum + channel.tokens, 0),
    totalPromptTokens: channels.reduce(
      (sum, channel) => sum + channel.promptTokens,
      0
    ),
    totalCompletionTokens: channels.reduce(
      (sum, channel) => sum + channel.completionTokens,
      0
    ),
    totalCacheTokens: channels.reduce(
      (sum, channel) => sum + channel.cacheTokens,
      0
    ),
    totalCacheCreationTokens: channels.reduce(
      (sum, channel) => sum + channel.cacheCreationTokens,
      0
    ),
    totalRequests: channels.reduce((sum, channel) => sum + channel.requests, 0),
    activeChannels: channels.length,
    enabledChannels: channels.filter((channel) => channel.status === 1).length,
    avgResponseTime,
    topChannel: channels[0],
  }
}

function buildChannelOptions(channels: ChannelAggregate[]): FilterOption[] {
  return channels.map((channel) => ({
    value: String(channel.id),
    label: channel.name,
  }))
}

function buildModelOptions(data: ChannelQuotaReportItem[]): FilterOption[] {
  return [...new Set(data.map((item) => item.model_name || 'Unknown'))]
    .sort((a, b) => a.localeCompare(b))
    .map((model) => ({
      value: model,
      label: model,
    }))
}

function filterReportData(
  data: ChannelQuotaReportItem[],
  selectedChannel: string,
  selectedModel: string,
  selectedStatus: StatusFilter
) {
  return data.filter((item) => {
    if (
      selectedChannel !== ALL_FILTER_VALUE &&
      String(item.channel_id) !== selectedChannel
    ) {
      return false
    }
    if (
      selectedModel !== ALL_FILTER_VALUE &&
      (item.model_name || 'Unknown') !== selectedModel
    ) {
      return false
    }
    if (selectedStatus === 'enabled') return Number(item.status) === 1
    if (selectedStatus === 'disabled') return Number(item.status) !== 1
    return true
  })
}

function buildChannelRankSpec(
  channels: ChannelAggregate[],
  metric: ChannelMetric,
  splitTokenBreakdown: boolean,
  t: (key: string) => string
): ChartSpec {
  const topChannels = channels.slice(0, TOP_CHANNEL_LIMIT)
  const values =
    metric === 'total_tokens' && splitTokenBreakdown
      ? topChannels.flatMap((channel) =>
          channelTokenSegments(channel, t).map((segment) => ({
            channel: channel.name,
            value: segment.value,
            tokenType: segment.tokenType,
            requests: channel.requests,
          }))
        )
      : topChannels.map((channel) => ({
          channel: channel.name,
          value: channel.value,
          tokenType: channel.name,
          requests: channel.requests,
        }))

  return {
    type: 'bar',
    direction: 'horizontal',
    data: [{ id: 'channelRank', values }],
    xField: 'value',
    yField: 'channel',
    seriesField:
      metric === 'total_tokens' && splitTokenBreakdown
        ? 'tokenType'
        : 'channel',
    stack: metric === 'total_tokens' && splitTokenBreakdown,
    title: { visible: true, text: t('Channel Consumption Ranking') },
    axes: [
      {
        orient: 'bottom',
        label: {
          visible: false,
          formatMethod: (value: number | string) =>
            formatMetricValue(metric, Number(value) || 0),
        },
      },
      { orient: 'left' },
    ],
    legends: {
      visible: metric === 'total_tokens' && splitTokenBreakdown,
      orient: 'bottom',
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) =>
              datum.tokenType ?? datum.channel,
            value: (datum: Record<string, unknown>) =>
              formatTooltipDatum(metric, datum),
          },
        ],
        updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
      },
    },
  }
}

function buildModelDistributionSpec(
  data: ChannelQuotaReportItem[],
  topChannels: ChannelAggregate[],
  metric: ChannelMetric,
  splitTokenBreakdown: boolean,
  t: (key: string) => string
): ChartSpec {
  const channelIDs = new Set(topChannels.map((channel) => channel.id))
  const modelTotals = new Map<string, number>()
  data.forEach((item) => {
    if (!channelIDs.has(item.channel_id)) return
    const model = item.model_name || 'Unknown'
    modelTotals.set(
      model,
      (modelTotals.get(model) ?? 0) + channelMetricValue(item, metric)
    )
  })
  const topModels = new Set(
    [...modelTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_MODEL_LIMIT)
      .map(([model]) => model)
  )

  if (metric === 'total_tokens' && splitTokenBreakdown) {
    const segmentMap = new Map<string, number>()
    data.forEach((item) => {
      if (!channelIDs.has(item.channel_id)) return
      const channel = channelLabel(item)
      const modelName = item.model_name || 'Unknown'
      const model = topModels.has(modelName) ? modelName : t('Other')
      const promptTokens = item.prompt_tokens ?? 0
      const completionTokens = item.completion_tokens ?? 0
      const cacheTokens = item.cache_tokens ?? 0
      const cacheCreationTokens = item.cache_creation_tokens ?? 0
      const segments = tokenSegments(
        promptTokens,
        completionTokens,
        cacheTokens,
        cacheCreationTokens,
        t
      )
      segments.forEach((segment) => {
        const key = `${channel}\u0000${model}\u0000${segment.tokenType}`
        segmentMap.set(key, (segmentMap.get(key) ?? 0) + segment.value)
      })
    })

    const values = [...segmentMap.entries()].map(([key, value]) => {
      const [channel, model, tokenType] = key.split('\u0000')
      return { channel, model, tokenType, value }
    })

    return {
      type: 'bar',
      data: [{ id: 'channelModels', values }],
      xField: ['channel', 'model'],
      yField: 'value',
      seriesField: 'tokenType',
      stack: true,
      title: { visible: true, text: t('Model Usage by Channel') },
      axes: [
        { orient: 'bottom' },
        {
          orient: 'left',
          label: {
            formatMethod: (value: number | string) =>
              formatMetricValue(metric, Number(value) || 0),
          },
        },
      ],
      legends: { visible: true, orient: 'bottom' },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum.tokenType,
              value: (datum: Record<string, unknown>) =>
                formatTooltipDatum(metric, datum),
            },
          ],
          updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
        },
        dimension: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum.tokenType,
              value: (datum: Record<string, unknown>) =>
                formatTooltipDatum(metric, datum),
            },
          ],
          updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
        },
      },
    }
  }

  const valueMap = new Map<string, number>()
  data.forEach((item) => {
    if (!channelIDs.has(item.channel_id)) return
    const name = channelLabel(item)
    const modelName = item.model_name || 'Unknown'
    const model = topModels.has(modelName) ? modelName : t('Other')
    const key = `${name}\u0000${model}`
    valueMap.set(
      key,
      (valueMap.get(key) ?? 0) + channelMetricValue(item, metric)
    )
  })

  const values = [...valueMap.entries()].map(([key, value]) => {
    const [channel, model] = key.split('\u0000')
    return { channel, model, value }
  })

  return {
    type: 'bar',
    data: [{ id: 'channelModels', values }],
    xField: 'channel',
    yField: 'value',
    seriesField: 'model',
    stack: true,
    title: { visible: true, text: t('Model Usage by Channel') },
    axes: [
      { orient: 'bottom' },
      {
        orient: 'left',
        label: {
          formatMethod: (value: number | string) =>
            formatMetricValue(metric, Number(value) || 0),
        },
      },
    ],
    legends: { visible: true, orient: 'bottom' },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum.model,
            value: (datum: Record<string, unknown>) =>
              formatTooltipDatum(metric, datum),
          },
        ],
        updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
      },
      dimension: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum.model,
            value: (datum: Record<string, unknown>) =>
              formatTooltipDatum(metric, datum),
          },
        ],
        updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
      },
    },
  }
}

function buildTrendSpec(
  data: ChannelQuotaReportItem[],
  topChannels: ChannelAggregate[],
  metric: ChannelMetric,
  rangeDays: number,
  view: ChannelTrendView,
  t: (key: string) => string
): ChartSpec {
  const channelIDs = new Set(topChannels.slice(0, 6).map((item) => item.id))
  const valueMap = new Map<
    string,
    { time: string; channel: string; value: number }
  >()
  const granularity = rangeDays <= 1 ? 'hour' : 'day'
  data.forEach((item) => {
    if (!channelIDs.has(item.channel_id)) return
    const name = channelLabel(item)
    const bucket = channelChartBucketTimestamp(item.created_at, rangeDays)
    const key = `${bucket}\u0000${name}`
    const current = valueMap.get(key)
    if (current) {
      current.value += channelMetricValue(item, metric)
      return
    }
    valueMap.set(key, {
      time: formatChartTime(bucket, granularity),
      channel: name,
      value: channelMetricValue(item, metric),
    })
  })
  const values = [...valueMap.entries()]
    .sort(([a], [b]) => {
      const [aTime, aChannel] = a.split('\u0000')
      const [bTime, bChannel] = b.split('\u0000')
      const timeDiff = Number(aTime) - Number(bTime)
      if (timeDiff !== 0) return timeDiff
      return aChannel.localeCompare(bChannel)
    })
    .map(([, value]) => value)

  return {
    type: view === 'trend' ? 'line' : 'bar',
    data: [{ id: 'channelTrend', values }],
    xField: 'time',
    yField: 'value',
    seriesField: 'channel',
    stack: view === 'bar',
    title: {
      visible: true,
      text:
        view === 'trend'
          ? t('Channel Consumption Trend')
          : t('Channel Consumption by Period'),
    },
    axes: [
      { orient: 'bottom' },
      {
        orient: 'left',
        label: {
          formatMethod: (value: number | string) =>
            formatMetricValue(metric, Number(value) || 0),
        },
      },
    ],
    legends: { visible: true, orient: 'bottom' },
    line: {
      style: { lineWidth: 2 },
    },
    point: {
      visible: rangeDays <= 1,
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum.channel,
            value: (datum: Record<string, unknown>) =>
              formatTooltipDatum(metric, datum),
          },
        ],
        updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
      },
      dimension: {
        content: [
          {
            key: (datum: Record<string, unknown>) => datum.channel,
            value: (datum: Record<string, unknown>) =>
              formatTooltipDatum(metric, datum),
          },
        ],
        updateContent: (rows: TooltipRow[]) => formatTooltipRows(metric, rows),
      },
    },
  }
}

function SummaryCard(props: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  detailValue?: string
}) {
  const Icon = props.icon
  const value = (
    <div className='mt-2 w-fit max-w-full truncate text-xl font-semibold tracking-normal'>
      {props.value}
    </div>
  )
  return (
    <div className='rounded-lg border px-4 py-3.5 sm:px-5 sm:py-4'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium'>
        <Icon className='size-4' aria-hidden='true' />
        <span>{props.label}</span>
      </div>
      {props.detailValue && props.detailValue !== props.value ? (
        <TooltipProvider delay={100}>
          <Tooltip>
            <TooltipTrigger render={value} />
            <TooltipContent side='top' className='font-mono text-xs'>
              {props.detailValue}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        value
      )}
      <div className='text-muted-foreground mt-1 text-xs'>{props.detail}</div>
    </div>
  )
}

function ChartPanel(props: {
  icon: ComponentType<{ className?: string }>
  title: string
  spec: ChartSpec
  chartKey: string
  loading: boolean
  themeReady: boolean
  theme: 'dark' | 'light'
  actions?: ReactNode
}) {
  const Icon = props.icon
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-2 border-b px-3 py-2 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <Icon className='text-muted-foreground/60 size-4' aria-hidden='true' />
          <div className='text-sm font-semibold'>{props.title}</div>
        </div>
        {props.actions}
      </div>
      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {props.loading ? (
          <Skeleton className='h-full w-full' />
        ) : (
          props.themeReady && (
            <VChart
              key={props.chartKey}
              spec={{
                ...props.spec,
                theme: props.theme,
                background: 'transparent',
                color: getDashboardChartColors(12),
              }}
              option={VCHART_OPTION}
            />
          )
        )}
      </div>
    </div>
  )
}

function TokenBreakdownAction(props: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return (
    <div className='flex items-center gap-2 rounded-lg border px-2.5 py-1.5'>
      <Label className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </Label>
      <Switch
        size='sm'
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
    </div>
  )
}

function FilterSelect(props: {
  label: string
  value: string
  allLabel: string
  options: FilterOption[]
  onValueChange: (value: string) => void
}) {
  return (
    <div className='grid min-w-40 flex-1 gap-1.5 sm:flex-initial'>
      <Label className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </Label>
      <Select
        items={[
          { value: ALL_FILTER_VALUE, label: props.allLabel },
          ...props.options,
        ]}
        value={props.value}
        onValueChange={(value) =>
          props.onValueChange(value ?? ALL_FILTER_VALUE)
        }
      >
        <SelectTrigger className='w-full'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value={ALL_FILTER_VALUE}>{props.allLabel}</SelectItem>
            {props.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export function ChannelAnalytics() {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [selectedRange, setSelectedRange] = useState(7)
  const [selectedChannel, setSelectedChannel] = useState(ALL_FILTER_VALUE)
  const [selectedModel, setSelectedModel] = useState(ALL_FILTER_VALUE)
  const [selectedStatus, setSelectedStatus] =
    useState<StatusFilter>(ALL_FILTER_VALUE)
  const [selectedMetric, setSelectedMetric] = useState<ChannelMetric>('quota')
  const [splitTokenBreakdown, setSplitTokenBreakdown] = useState(true)
  const [activeTrendView, setActiveTrendView] =
    useState<ChannelTrendView>('trend')
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    void updateTheme()
  }, [resolvedTheme])

  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(selectedRange)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  }, [selectedRange])

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'channel-report', timeRange],
    queryFn: () => getChannelQuotaReportData(timeRange),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const reportData = useMemo(() => data ?? [], [data])
  const allChannels = useMemo(
    () => buildChannelAggregates(reportData, selectedMetric),
    [reportData, selectedMetric]
  )
  const metricOptions = useMemo(
    () => [
      { value: 'quota', label: t('Amount') },
      { value: 'total_tokens', label: t('Total Tokens') },
      { value: 'prompt_tokens', label: t('Input Tokens') },
      { value: 'completion_tokens', label: t('Output Tokens') },
      { value: 'cache_tokens', label: t('Cache Read Tokens') },
      { value: 'cache_creation_tokens', label: t('Cache Write Tokens') },
      { value: 'requests', label: t('Requests') },
    ],
    [t]
  )
  const channelOptions = useMemo(
    () => buildChannelOptions(allChannels),
    [allChannels]
  )
  const modelOptionData = useMemo(
    () =>
      filterReportData(
        reportData,
        selectedChannel,
        ALL_FILTER_VALUE,
        selectedStatus
      ),
    [reportData, selectedChannel, selectedStatus]
  )
  const modelOptions = useMemo(
    () => buildModelOptions(modelOptionData),
    [modelOptionData]
  )
  const filteredReportData = useMemo(
    () =>
      filterReportData(
        reportData,
        selectedChannel,
        selectedModel,
        selectedStatus
      ),
    [reportData, selectedChannel, selectedModel, selectedStatus]
  )

  useEffect(() => {
    if (selectedMetric === 'total_tokens') {
      setSplitTokenBreakdown(true)
      return
    }
    setSplitTokenBreakdown(false)
  }, [selectedMetric])

  useEffect(() => {
    if (selectedChannel === ALL_FILTER_VALUE) {
      return
    }
    if (channelOptions.some((option) => option.value === selectedChannel)) {
      return
    }
    setSelectedChannel(ALL_FILTER_VALUE)
    setSelectedModel(ALL_FILTER_VALUE)
  }, [channelOptions, selectedChannel])

  useEffect(() => {
    if (selectedModel === ALL_FILTER_VALUE) {
      return
    }
    if (modelOptions.some((option) => option.value === selectedModel)) {
      return
    }
    setSelectedModel(ALL_FILTER_VALUE)
  }, [modelOptions, selectedModel])

  const channels = useMemo(
    () => buildChannelAggregates(filteredReportData, selectedMetric),
    [filteredReportData, selectedMetric]
  )
  const summary = useMemo(() => buildSummary(channels), [channels])
  const topChannels = useMemo(
    () => channels.slice(0, TOP_CHANNEL_LIMIT),
    [channels]
  )
  const chartTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const rankSpec = useMemo(
    () =>
      buildChannelRankSpec(channels, selectedMetric, splitTokenBreakdown, t),
    [channels, selectedMetric, splitTokenBreakdown, t]
  )
  const modelSpec = useMemo(
    () =>
      buildModelDistributionSpec(
        filteredReportData,
        topChannels,
        selectedMetric,
        splitTokenBreakdown,
        t
      ),
    [filteredReportData, selectedMetric, splitTokenBreakdown, topChannels, t]
  )
  const trendSpec = useMemo(
    () =>
      buildTrendSpec(
        filteredReportData,
        topChannels,
        selectedMetric,
        selectedRange,
        activeTrendView,
        t
      ),
    [
      activeTrendView,
      filteredReportData,
      selectedMetric,
      selectedRange,
      topChannels,
      t,
    ]
  )
  const statusOptions = useMemo(
    () => [
      { value: 'enabled', label: t('Enabled Channels') },
      { value: 'disabled', label: t('Disabled Channels') },
    ],
    [t]
  )
  const averageLatencyValue =
    summary.avgResponseTime > 0
      ? `${formatInt(summary.avgResponseTime)} ms`
      : t('No data')
  const averageLatencyDetail = summary.topChannel
    ? t('Top: {{name}}', { name: summary.topChannel.name })
    : t('No channel traffic')
  const channelSpend = formatSummaryQuota(summary.totalQuota)
  let healthContent: ReactNode
  if (isLoading) {
    healthContent = HEALTH_SKELETON_ROWS.map((placeholder) => (
      <div
        key={placeholder}
        className='grid gap-3 px-3 py-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:px-5'
      >
        <Skeleton className='h-5 w-36' />
        <Skeleton className='h-5 w-20' />
        <Skeleton className='h-5 w-24' />
        <Skeleton className='h-5 w-28' />
      </div>
    ))
  } else if (channels.length === 0) {
    healthContent = (
      <div className='text-muted-foreground px-3 py-10 text-center text-sm sm:px-5'>
        {t('No channel data available')}
      </div>
    )
  } else {
    healthContent = channels.slice(0, TOP_CHANNEL_LIMIT).map((channel) => {
      const status = channelStatusConfig(channel.status)
      return (
        <div
          key={channel.id}
          className='grid gap-3 px-3 py-3 text-sm sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:items-center sm:px-5'
        >
          <div className='min-w-0'>
            <div className='truncate font-medium'>{channel.name}</div>
            <div className='text-muted-foreground text-xs'>
              {t('Top model: {{model}}', {
                model: channel.topModel || t('Unknown'),
              })}
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <StatusBadge variant={status.variant} copyable={false}>
              {t(status.label)}
            </StatusBadge>
            <StatusBadge
              variant={healthVariant(channel.status, channel.responseTime)}
              copyable={false}
            >
              {t(healthLabelKey(channel.status, channel.responseTime))}
            </StatusBadge>
          </div>
          <div>
            <div className='font-medium'>
              {formatMetricValue(selectedMetric, channel.value)}
            </div>
            <div className='text-muted-foreground text-xs'>
              {formatInt(channel.requests)} {t('requests')}
            </div>
          </div>
          <div
            className={cn(
              'text-sm font-medium',
              channel.responseTime > SLOW_LATENCY_MS && 'text-destructive',
              channel.responseTime > HEALTHY_LATENCY_MS &&
                channel.responseTime <= SLOW_LATENCY_MS &&
                'text-amber-600 dark:text-amber-400'
            )}
          >
            {channel.responseTime > 0
              ? `${formatInt(channel.responseTime)} ms`
              : t('No test data')}
          </div>
        </div>
      )
    })
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4'>
        <div className='grid gap-1.5 sm:w-60'>
          <Label className='text-muted-foreground text-xs font-medium'>
            {t('Time Range')}
          </Label>
          <Tabs
            value={String(selectedRange)}
            onValueChange={(value) => setSelectedRange(Number(value))}
          >
            <TabsList className='w-full'>
              {TIME_RANGE_PRESETS.map((preset) => (
                <TabsTrigger
                  key={preset.days}
                  value={String(preset.days)}
                  className='flex-1 px-2.5 text-xs'
                >
                  {t(preset.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className='grid min-w-40 flex-1 gap-1.5 sm:flex-initial'>
          <Label className='text-muted-foreground text-xs font-medium'>
            {t('Report Unit')}
          </Label>
          <Select
            items={metricOptions}
            value={selectedMetric}
            onValueChange={(value) =>
              setSelectedMetric((value ?? 'quota') as ChannelMetric)
            }
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {metricOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <FilterSelect
          label={t('Channel')}
          value={selectedChannel}
          allLabel={t('All Channels')}
          options={channelOptions}
          onValueChange={(value) => {
            setSelectedChannel(value)
            setSelectedModel(ALL_FILTER_VALUE)
          }}
        />
        <FilterSelect
          label={t('Model')}
          value={selectedModel}
          allLabel={t('All Models')}
          options={modelOptions}
          onValueChange={setSelectedModel}
        />
        <FilterSelect
          label={t('Status')}
          value={selectedStatus}
          allLabel={t('All Status')}
          options={statusOptions}
          onValueChange={(value) => setSelectedStatus(value as StatusFilter)}
        />
        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin sm:mb-2' />
        )}
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-6'>
        <SummaryCard
          icon={CircleDollarSign}
          label={t('Channel Spend')}
          value={channelSpend.value}
          detailValue={channelSpend.detailValue}
          detail={t('Total billed amount')}
        />
        <SummaryCard
          icon={Sparkles}
          label={t('Channel Tokens')}
          value={formatInt(summary.totalTokens)}
          detail={t('Input {{input}}, Output {{output}}', {
            input: formatInt(summary.totalPromptTokens),
            output: formatInt(summary.totalCompletionTokens),
          })}
        />
        <SummaryCard
          icon={Database}
          label={t('Cache Tokens')}
          value={formatInt(
            summary.totalCacheTokens + summary.totalCacheCreationTokens
          )}
          detail={t('Read {{read}}, Write {{write}}', {
            read: formatInt(summary.totalCacheTokens),
            write: formatInt(summary.totalCacheCreationTokens),
          })}
        />
        <SummaryCard
          icon={Activity}
          label={t('Channel Requests')}
          value={formatInt(summary.totalRequests)}
          detail={t('Successful calls routed through channels')}
        />
        <SummaryCard
          icon={Radio}
          label={t('Active Channels')}
          value={formatInt(summary.activeChannels)}
          detail={t('{{count}} enabled', { count: summary.enabledChannels })}
        />
        <SummaryCard
          icon={Gauge}
          label={t('Average Latency')}
          value={averageLatencyValue}
          detail={averageLatencyDetail}
        />
      </div>

      <div className='grid gap-3 xl:grid-cols-2'>
        <ChartPanel
          icon={BarChart3}
          title={t('Channel Consumption Ranking')}
          spec={rankSpec}
          chartKey={`channel-rank-${selectedRange}-${selectedChannel}-${selectedModel}-${selectedStatus}-${selectedMetric}-${splitTokenBreakdown}-${resolvedTheme}-${channels.length}`}
          loading={isLoading}
          themeReady={themeReady}
          theme={chartTheme}
          actions={
            selectedMetric === 'total_tokens' ? (
              <TokenBreakdownAction
                checked={splitTokenBreakdown}
                onCheckedChange={setSplitTokenBreakdown}
                label={t('Token Breakdown')}
              />
            ) : null
          }
        />
        <ChartPanel
          icon={BarChart3}
          title={t('Model Usage by Channel')}
          spec={modelSpec}
          chartKey={`channel-models-${selectedRange}-${selectedChannel}-${selectedModel}-${selectedStatus}-${selectedMetric}-${splitTokenBreakdown}-${resolvedTheme}-${filteredReportData.length}`}
          loading={isLoading}
          themeReady={themeReady}
          theme={chartTheme}
          actions={
            selectedMetric === 'total_tokens' ? (
              <TokenBreakdownAction
                checked={splitTokenBreakdown}
                onCheckedChange={setSplitTokenBreakdown}
                label={t('Token Breakdown')}
              />
            ) : null
          }
        />
      </div>

      <ChartPanel
        icon={Activity}
        title={t('Channel Consumption Trend')}
        spec={trendSpec}
        chartKey={`channel-trend-${activeTrendView}-${selectedRange}-${selectedChannel}-${selectedModel}-${selectedStatus}-${selectedMetric}-${resolvedTheme}-${filteredReportData.length}`}
        loading={isLoading}
        themeReady={themeReady}
        theme={chartTheme}
        actions={
          <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
            {[
              { value: 'trend' as const, label: t('Trend Chart') },
              { value: 'bar' as const, label: t('Bar Chart') },
            ].map((item) => (
              <button
                key={item.value}
                type='button'
                aria-pressed={activeTrendView === item.value}
                onClick={() => setActiveTrendView(item.value)}
                className={cn(
                  'shrink-0 rounded-md px-3 text-xs font-medium transition-colors',
                  activeTrendView === item.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className='overflow-hidden rounded-lg border'>
        <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
          <Gauge className='text-muted-foreground/60 size-4' aria-hidden='true' />
          <div className='text-sm font-semibold'>{t('Channel Health')}</div>
        </div>
        <div className='divide-border divide-y'>{healthContent}</div>
      </div>
    </div>
  )
}
