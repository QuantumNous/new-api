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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
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
import { useAuthStore } from '@/stores/auth-store'
import dayjs from '@/lib/dayjs'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { computeTimeRange } from '@/lib/time'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserQuotaDates } from '@/features/dashboard/api'
import type { QuotaDataItem } from '@/features/dashboard/types'

const RANGE_OPTIONS = [
  { value: '1', labelKey: 'Today' },
  { value: '7', labelKey: 'Last 7 days' },
  { value: '30', labelKey: 'Last 30 days' },
]

interface BucketRow {
  bucket: string
  requests: number
  tokens: number
}

function buildHourlyBuckets(
  data: QuotaDataItem[],
  start: number,
  end: number,
  hours: number
): BucketRow[] {
  const buckets: BucketRow[] = Array.from({ length: hours }, (_, i) => {
    const ts = start + Math.floor(((end - start) / hours) * (i + 0.5))
    return {
      bucket: dayjs(ts * 1000).format(hours <= 24 ? 'HH:mm' : 'MM-DD'),
      requests: 0,
      tokens: 0,
    }
  })

  if (end <= start) return buckets

  for (const row of data) {
    const ts = Number(row.created_at) || start
    const ratio = (ts - start) / (end - start)
    const idx = Math.min(hours - 1, Math.max(0, Math.floor(ratio * hours)))
    buckets[idx].requests += Number(row.count) || 0
    buckets[idx].tokens += Number(row.token_used) || 0
  }

  return buckets
}

export function RealtimeUsageCard() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const [rangeDays, setRangeDays] = useState('1')

  const days = Number(rangeDays)
  const buckets = days <= 1 ? 24 : days

  const timeRange = useMemo(() => computeTimeRange(days), [days])

  const trendQuery = useQuery({
    queryKey: [
      'dashboard',
      'overview',
      'realtime-trend',
      days,
      timeRange.start_timestamp,
      timeRange.end_timestamp,
    ],
    queryFn: async () =>
      getUserQuotaDates({
        start_timestamp: timeRange.start_timestamp,
        end_timestamp: timeRange.end_timestamp,
        default_time: days <= 1 ? 'hour' : 'day',
      }),
    staleTime: 60 * 1000,
  })

  const series = useMemo(
    () =>
      buildHourlyBuckets(
        trendQuery.data?.data ?? [],
        timeRange.start_timestamp,
        timeRange.end_timestamp,
        buckets
      ),
    [trendQuery.data?.data, timeRange, buckets]
  )

  const totals = useMemo(() => {
    return series.reduce(
      (acc, row) => {
        acc.requests += row.requests
        acc.tokens += row.tokens
        return acc
      },
      { requests: 0, tokens: 0 }
    )
  }, [series])

  const remainQuota = Number(user?.quota ?? 0)
  const totalRequestCount = Number(user?.request_count ?? 0)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-2'>
        <CardTitle className='text-base sm:text-lg'>
          {t('Realtime Usage')}
        </CardTitle>
        <Select
          value={rangeDays}
          onValueChange={(v) => v && setRangeDays(v)}
        >
          <SelectTrigger className='h-8 w-24 text-xs'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='grid grid-cols-2 gap-3'>
          <UsageStat
            label={t('Requests')}
            value={formatNumber(totals.requests || totalRequestCount)}
            trend={totals.requests > 0 ? '+' : null}
          />
          <UsageStat
            label={t('Tokens used')}
            value={formatCompactNumber(totals.tokens)}
            trend={totals.tokens > 0 ? '+' : null}
          />
          <UsageStat
            label={t('Average latency')}
            value='--'
            hint={t('Tracking soon')}
          />
          <UsageStat
            label={t('Available Balance')}
            value={formatQuota(remainQuota)}
            cta={t('Top Up')}
            ctaHref='/wallet'
          />
        </div>

        <div className='h-44 w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id='req-grad' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--accent-blue)' stopOpacity={0.35} />
                  <stop offset='100%' stopColor='var(--accent-blue)' stopOpacity={0} />
                </linearGradient>
                <linearGradient id='tok-grad' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='0%' stopColor='var(--accent-cyan)' stopOpacity={0.35} />
                  <stop offset='100%' stopColor='var(--accent-cyan)' stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke='var(--border)' strokeDasharray='3 3' vertical={false} />
              <XAxis
                dataKey='bucket'
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval='preserveStartEnd'
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: 'var(--popover)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--foreground)' }}
              />
              <Area
                type='monotone'
                dataKey='requests'
                name={t('Requests')}
                stroke='var(--accent-blue)'
                strokeWidth={2}
                fill='url(#req-grad)'
              />
              <Area
                type='monotone'
                dataKey='tokens'
                name={t('Tokens used')}
                stroke='var(--accent-cyan)'
                strokeWidth={2}
                fill='url(#tok-grad)'
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
          <LegendDot color='var(--accent-blue)' label={t('Requests')} />
          <LegendDot color='var(--accent-cyan)' label={t('Tokens used')} />
          <span className='ml-auto inline-flex items-center gap-1'>
            <TrendingUp className='size-3' aria-hidden />
            {t('Live')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function UsageStat(props: {
  label: string
  value: string
  trend?: string | null
  hint?: string
  cta?: string
  ctaHref?: string
}) {
  return (
    <div className='rounded-xl border bg-background/50 px-3 py-2.5'>
      <div className='text-[10px] uppercase tracking-wide text-muted-foreground'>
        {props.label}
      </div>
      <div className='mt-1 flex items-baseline gap-1.5 font-semibold text-foreground'>
        <span className='text-lg tabular-nums sm:text-xl'>{props.value}</span>
        {props.trend && (
          <span className='text-xs font-medium text-success'>{props.trend}</span>
        )}
      </div>
      {props.hint && (
        <div className='text-[10px] text-muted-foreground'>{props.hint}</div>
      )}
      {props.cta && props.ctaHref && (
        <a
          href={props.ctaHref}
          className='mt-1 inline-block text-[11px] font-medium text-[var(--accent-blue)] hover:underline'
        >
          {props.cta}
        </a>
      )}
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span
        className='inline-block size-2 rounded-full'
        style={{ background: color }}
      />
      {label}
    </span>
  )
}
