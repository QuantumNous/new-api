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
  Area,
  AreaChart,
  CartesianGrid,
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
  FlowTrendPoint,
} from '../types'

type PoolStatusPanelProps = {
  pool?: ChannelFlowPool | null
  status?: ChannelFlowPoolStatus | null
  trend: FlowTrendPoint[]
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
            value={String(status?.lease_renew_failures ?? 0)}
          />
        </div>
      </div>

      <div className='flex min-h-[320px] flex-col rounded-lg border p-4'>
        <div className='mb-3 flex items-center justify-between'>
          <div>
            <h3 className='text-sm font-semibold'>
              {t('Inflight / queued trend')}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Recent frontend samples until minute metrics API is available')}
            </p>
          </div>
        </div>
        <div className='min-h-[260px] min-w-0 flex-1'>
          <ResponsiveContainer
            width='100%'
            height='100%'
            initialDimension={trendChartInitialDimension}
          >
            <AreaChart
              data={props.trend}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id='flowRunning' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--primary)' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='var(--primary)' stopOpacity={0} />
                </linearGradient>
                <linearGradient id='flowQueued' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='var(--destructive)' stopOpacity={0.25} />
                  <stop offset='95%' stopColor='var(--destructive)' stopOpacity={0} />
                </linearGradient>
              </defs>
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
                contentStyle={{
                  background: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
              />
              <Area
                type='monotone'
                dataKey='running'
                name={t('Inflight')}
                stroke='var(--primary)'
                fill='url(#flowRunning)'
                strokeWidth={2}
              />
              <Area
                type='monotone'
                dataKey='queued'
                name={t('Queued')}
                stroke='var(--destructive)'
                fill='url(#flowQueued)'
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
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
