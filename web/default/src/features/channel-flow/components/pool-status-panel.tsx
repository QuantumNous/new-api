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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  ChannelFlowPool,
  ChannelFlowPoolStatus,
  FlowTrendTotals,
  FlowTrendPoint,
} from '../types'

type TrendChartMode = 'requests' | 'capacity'

type PoolStatusPanelProps = {
  pool?: ChannelFlowPool | null
  status?: ChannelFlowPoolStatus | null
  trend: FlowTrendPoint[]
  trendTotals?: FlowTrendTotals
  trendRangeMinutes: number
  trendRangeOptions: Array<{ label: string; minutes: number }>
  onTrendRangeChange: (minutes: number) => void
  statusUpdatedAt: number
  statusRefreshMs: number
  statusRefreshOptions: Array<{ label: string; ms: number }>
  onStatusRefreshChange: (ms: number) => void
}

const trendChartInitialDimension = { width: 1, height: 300 }
const tooltipContentStyle = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
}
const trendChartModes: Array<{ label: string; value: TrendChartMode }> = [
  { label: 'Requests', value: 'requests' },
  { label: 'Capacity', value: 'capacity' },
]

export function PoolStatusPanel(props: PoolStatusPanelProps) {
  const { t } = useTranslation()
  const [chartMode, setChartMode] = useState<TrendChartMode>('requests')

  if (!props.pool) {
    return (
      <div className='border-border/80 flex min-h-48 items-center justify-center rounded-lg border border-dashed'>
        <span className='text-muted-foreground text-sm'>
          {t('Select a Flow Pool to inspect capacity')}
        </span>
      </div>
    )
  }

  const status = props.status
  const running = status?.running ?? 0
  const queued = status?.queued ?? 0
  const maxInflight = status?.max_inflight ?? props.pool.max_inflight
  const maxQueueSize = status?.max_queue_size ?? props.pool.max_queue_size
  const totals = props.trendTotals
  const requestCount = totals?.request_count ?? 0
  const succeededCount = totals?.succeeded_count ?? 0
  const scheduleActive = status?.schedule_active ?? false
  const selectedRefreshLabel =
    props.statusRefreshOptions.find(
      (option) => option.ms === props.statusRefreshMs
    )?.label ?? '5 sec'
  const selectedRangeLabel =
    props.trendRangeOptions.find(
      (option) => option.minutes === props.trendRangeMinutes
    )?.label ?? '1 hour'
  const backendLabel =
    props.pool.backend === 'redis' && status?.backend === 'memory'
      ? t('Local memory fallback')
      : props.pool.backend === 'redis'
        ? t('Redis')
        : t('Memory')

  return (
    <div className='grid items-stretch gap-3 xl:grid-cols-[minmax(280px,0.72fr)_minmax(520px,1.28fr)]'>
      <div className='space-y-3 rounded-lg border p-4'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {props.pool.name}
            </h3>
            <p className='text-muted-foreground mt-1 truncate text-xs'>
              {props.pool.pool_key}
            </p>
          </div>
          <div className='flex shrink-0 flex-wrap justify-end gap-1.5'>
            <ScheduleBadge active={scheduleActive} />
            <HealthBadge health={status?.health || 'unknown'} />
          </div>
        </div>

        <div className='bg-muted/20 space-y-3 rounded-lg border p-3'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <div className='text-xs font-medium'>{t('Latest status')}</div>
              <div className='text-muted-foreground mt-0.5 text-xs'>
                {props.statusUpdatedAt > 0
                  ? `${t('Updated')} ${formatStatusUpdatedAt(props.statusUpdatedAt)}`
                  : t('Not refreshed yet')}
              </div>
            </div>
            <Select
              value={String(props.statusRefreshMs)}
              onValueChange={(value) =>
                props.onStatusRefreshChange(Number(value))
              }
            >
              <SelectTrigger className='h-8 w-full text-xs sm:w-32'>
                <SelectValue>{t(selectedRefreshLabel)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {props.statusRefreshOptions.map((option) => (
                  <SelectItem key={option.ms} value={String(option.ms)}>
                    {t(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
            <CapacityMeter
              label={t('Inflight')}
              value={running}
              max={maxInflight}
            />
            <CapacityMeter
              label={t('Queued')}
              value={queued}
              max={maxQueueSize}
            />
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2 text-xs'>
          <Metric
            label={t('Oldest wait')}
            value={formatMs(status?.oldest_wait_ms)}
          />
          <Metric
            label={t('Config version')}
            value={String(status?.config_version ?? props.pool.config_version)}
          />
          <Metric label={t('Backend')} value={backendLabel} />
          <Metric
            label={t('Schedule')}
            value={getScheduleModeLabel(props.pool.schedule_mode, t)}
          />
          <Metric
            label={t('Per-user queue cap')}
            value={formatLimit(props.pool.max_queue_per_user)}
          />
          <Metric
            label={t('Per-user inflight cap')}
            value={formatLimit(props.pool.max_inflight_per_user)}
          />
          <Metric
            label={t('Lease renew failures')}
            value={String(
              props.trendTotals?.lease_renew_fail ??
                status?.lease_renew_failures ??
                0
            )}
          />
        </div>
      </div>

      <div className='flex min-h-[460px] flex-col rounded-lg border p-4'>
        <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h3 className='text-sm font-semibold'>
              {t('Flow Pool analytics')}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Selected range summary')}: {t(selectedRangeLabel)}
            </p>
          </div>
          <div className='bg-muted/20 inline-flex w-fit rounded-md border p-0.5'>
            {props.trendRangeOptions.map((option) => {
              const selected = option.minutes === props.trendRangeMinutes
              return (
                <button
                  key={option.minutes}
                  type='button'
                  aria-pressed={selected}
                  className={
                    selected
                      ? 'bg-background text-foreground h-7 rounded px-2.5 text-xs font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground h-7 rounded px-2.5 text-xs font-medium'
                  }
                  onClick={() => props.onTrendRangeChange(option.minutes)}
                >
                  {t(option.label)}
                </button>
              )
            })}
          </div>
        </div>
        <div className='mb-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4'>
          <Metric
            label={t('Total requests')}
            value={formatCount(requestCount)}
          />
          <Metric label={t('Succeeded')} value={formatCount(succeededCount)} />
          <Metric
            label={t('Success rate')}
            value={formatPercent(succeededCount, requestCount)}
          />
          <Metric
            label={t('Rejected')}
            value={formatCount(totals?.rejected_count ?? 0)}
          />
          <Metric
            label={t('Queued requests')}
            value={formatCount(totals?.queued_count ?? 0)}
          />
          <Metric
            label={t('Timeouts')}
            value={formatCount(totals?.timeout_count ?? 0)}
          />
          <Metric
            label={t('Peak inflight')}
            value={`${formatCount(totals?.running_max ?? 0)}/${formatLimit(maxInflight)}`}
          />
          <Metric
            label={t('Peak queued')}
            value={`${formatCount(totals?.queued_max ?? 0)}/${formatLimit(maxQueueSize)}`}
          />
        </div>

        <div className='mb-2 flex items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs'>
            {chartMode === 'capacity'
              ? t('Capacity peaks per minute')
              : t('Request outcomes per minute')}
          </p>
          <div className='bg-muted/20 inline-flex w-fit rounded-md border p-0.5'>
            {trendChartModes.map((option) => {
              const selected = option.value === chartMode
              return (
                <button
                  key={option.value}
                  type='button'
                  aria-pressed={selected}
                  className={
                    selected
                      ? 'bg-background text-foreground h-7 rounded px-2.5 text-xs font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground h-7 rounded px-2.5 text-xs font-medium'
                  }
                  onClick={() => setChartMode(option.value)}
                >
                  {t(option.label)}
                </button>
              )
            })}
          </div>
        </div>
        <div className='min-h-[260px] min-w-0 flex-1'>
          <ResponsiveContainer
            width='100%'
            height='100%'
            initialDimension={trendChartInitialDimension}
          >
            {chartMode === 'capacity' ? (
              <LineChart
                data={props.trend}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis
                  dataKey='at'
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Legend verticalAlign='top' height={28} />
                <Tooltip
                  formatter={formatTrendTooltipValue}
                  contentStyle={tooltipContentStyle}
                />
                <Line
                  type='linear'
                  dataKey='running_max'
                  name={`${t('Inflight')} ${t('Peak')}`}
                  stroke='var(--primary)'
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type='linear'
                  dataKey='queued_max'
                  name={`${t('Queued')} ${t('Peak')}`}
                  stroke='var(--destructive)'
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <ComposedChart
                data={props.trend}
                margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
              >
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis
                  dataKey='at'
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                  tickMargin={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Legend verticalAlign='top' height={28} />
                <Tooltip
                  formatter={formatTrendTooltipValue}
                  contentStyle={tooltipContentStyle}
                />
                <Bar
                  dataKey='succeeded_count'
                  name={t('Succeeded')}
                  stackId='outcomes'
                  fill='var(--chart-2)'
                  isAnimationActive={false}
                />
                <Bar
                  dataKey='failed_count'
                  name={t('Failed')}
                  stackId='outcomes'
                  fill='var(--chart-4)'
                  isAnimationActive={false}
                />
                <Bar
                  dataKey='rejected_count'
                  name={t('Rejected')}
                  stackId='outcomes'
                  fill='var(--destructive)'
                  isAnimationActive={false}
                />
                <Bar
                  dataKey='timeout_count'
                  name={t('Timeouts')}
                  stackId='outcomes'
                  fill='var(--chart-5)'
                  isAnimationActive={false}
                />
                <Line
                  type='linear'
                  dataKey='request_count'
                  name={t('Total requests')}
                  stroke='var(--primary)'
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function formatTrendTooltipValue(
  value: unknown,
  name: unknown
): [string, string] {
  return [formatTrendCount(value), String(name ?? '')]
}

function formatTrendCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value ?? '')
  }
  return String(Math.round(value))
}

function formatCount(value?: number): string {
  if (!value || value <= 0) {
    return '0'
  }
  return new Intl.NumberFormat().format(Math.round(value))
}

function formatStatusUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatPercent(value?: number, total?: number): string {
  if (!value || !total || total <= 0) {
    return '0%'
  }
  return `${((value / total) * 100).toFixed(1)}%`
}

function CapacityMeter(props: { label: string; value: number; max: number }) {
  const displayMax = props.max > 0 ? props.max : '∞'
  const percent =
    props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-3 text-xs'>
        <span className='text-muted-foreground'>{props.label}</span>
        <span className='font-medium tabular-nums'>
          {props.value}/{displayMax}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className='bg-muted/20 rounded-md border p-2'>
      <div className='text-muted-foreground'>{props.label}</div>
      <div className='mt-1 truncate font-medium tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}

function HealthBadge(props: { health: string }) {
  const { t } = useTranslation()
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary'
  let label = t('Unknown')
  if (props.health === 'critical') {
    variant = 'destructive'
    label = t('Critical')
  } else if (props.health === 'healthy') {
    variant = 'default'
    label = t('Healthy')
  } else if (props.health === 'degraded') {
    variant = 'outline'
    label = t('Degraded')
  } else if (props.health === 'busy') {
    label = t('Busy')
  } else if (props.health === 'congested') {
    label = t('Congested')
  }

  return <Badge variant={variant}>{label}</Badge>
}

function ScheduleBadge(props: { active: boolean }) {
  const { t } = useTranslation()
  return (
    <Badge variant={props.active ? 'outline' : 'secondary'}>
      {props.active ? t('Active now') : t('Inactive now')}
    </Badge>
  )
}

function getScheduleModeLabel(
  mode: ChannelFlowPool['schedule_mode'],
  t: (key: string) => string
) {
  if (mode === 'datetime_range') return t('Date range')
  if (mode === 'weekly') return t('Weekly schedule')
  return t('Always active')
}

function formatMs(value?: number): string {
  if (!value || value <= 0) return '0 ms'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function formatLimit(value?: number): string {
  if (!value || value <= 0) return '∞'
  return String(value)
}
