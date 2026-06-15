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

import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type {
  ChannelFlowPool,
  ChannelFlowPoolStatus,
  FlowTrendTotals,
  FlowTrendPoint,
} from '../types'

type PoolStatusPanelProps = {
  pool?: ChannelFlowPool | null
  status?: ChannelFlowPoolStatus | null
  trend: FlowTrendPoint[]
  trendTotals?: FlowTrendTotals
  trendRangeMinutes: number
  trendRangeOptions: Array<{ label: string; minutes: number }>
  onTrendRangeChange: (minutes: number) => void
}

const trendChartInitialDimension = { width: 1, height: 300 }

export function PoolStatusPanel(props: PoolStatusPanelProps) {
  const { t } = useTranslation()

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
            <h3 className='truncate text-sm font-semibold'>{props.pool.name}</h3>
            <p className='text-muted-foreground mt-1 truncate text-xs'>
              {props.pool.pool_key}
            </p>
          </div>
          <HealthBadge health={status?.health || 'unknown'} />
        </div>

        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
          <CapacityMeter
            label={t('Inflight')}
            value={running}
            max={maxInflight}
          />
          <CapacityMeter label={t('Queued')} value={queued} max={maxQueueSize} />
        </div>

        <div className='grid grid-cols-2 gap-2 text-xs'>
          <Metric label={t('Oldest wait')} value={formatMs(status?.oldest_wait_ms)} />
          <Metric
            label={t('Config version')}
            value={String(status?.config_version ?? props.pool.config_version)}
          />
          <Metric
            label={t('Backend')}
            value={backendLabel}
          />
          <Metric
            label={t('Per-user queue cap')}
            value={formatLimit(props.pool.max_queue_per_user)}
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

      <div className='flex min-h-[320px] flex-col rounded-lg border p-4'>
        <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h3 className='text-sm font-semibold'>
              {t('Inflight / queued trend')}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Minute peak history')}
            </p>
          </div>
          <div className='inline-flex w-fit rounded-md border bg-muted/20 p-0.5'>
            {props.trendRangeOptions.map((option) => {
              const selected = option.minutes === props.trendRangeMinutes
              return (
                <button
                  key={option.minutes}
                  type='button'
                  aria-pressed={selected}
                  className={
                    selected
                      ? 'bg-background text-foreground shadow-xs h-7 rounded px-2.5 text-xs font-medium'
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
        <div className='mb-3 grid gap-2 text-xs sm:grid-cols-3'>
          <Metric
            label={t('Rejected')}
            value={String(props.trendTotals?.rejected_count ?? 0)}
          />
          <Metric
            label={t('Timeouts')}
            value={String(props.trendTotals?.timeout_count ?? 0)}
          />
          <Metric
            label={t('Avg wait')}
            value={formatMs(props.trendTotals?.wait_ms_avg)}
          />
        </div>
        <div className='min-h-[260px] min-w-0 flex-1'>
          <ResponsiveContainer
            width='100%'
            height='100%'
            initialDimension={trendChartInitialDimension}
          >
            <LineChart
              data={props.trend}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
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
                width={32}
              />
              <Tooltip
                formatter={formatTrendTooltipValue}
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
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
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function formatTrendTooltipValue(value: unknown, name: unknown) {
  return [formatTrendCount(value), name]
}

function formatTrendCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return String(value ?? '')
  }
  return String(Math.round(value))
}

function CapacityMeter(props: { label: string; value: number; max: number }) {
  const displayMax = props.max > 0 ? props.max : '∞'
  const percent = props.max > 0 ? Math.min(100, (props.value / props.max) * 100) : 0

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
    <div className='rounded-md border bg-muted/20 p-2'>
      <div className='text-muted-foreground'>{props.label}</div>
      <div className='mt-1 truncate font-medium tabular-nums'>{props.value}</div>
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

function formatMs(value?: number): string {
  if (!value || value <= 0) return '0 ms'
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function formatLimit(value?: number): string {
  if (!value || value <= 0) return '∞'
  return String(value)
}
