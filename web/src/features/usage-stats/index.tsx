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
import { Loader2, RefreshCw, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import dayjs from '@/lib/dayjs'
import {
  formatNumber,
  formatPercent,
  formatQuota,
  formatTokens,
} from '@/lib/format'
import { computeTimeRange, getRollingDateRange } from '@/lib/time'

import { getUsageStat } from './api'
import { CacheHitRateChart } from './components/cache-hit-rate-chart'
import { UsageStatTable } from './components/usage-stat-table'
import type { UsageStatDimension } from './types'

const DEFAULT_RANGE_DAYS = 1
const PRESET_DAYS = [1, 3, 7, 30]
const USAGE_STAT_QUERY_KEY = 'usage-stat'

type SummaryCardProps = {
  label: string
  value: string
  hint?: string
}

function SummaryCard(props: SummaryCardProps) {
  return (
    <div className='rounded-lg border px-3 py-2'>
      <div className='text-muted-foreground truncate text-xs'>
        {props.label}
      </div>
      <div className='mt-1 truncate font-mono text-sm font-semibold tabular-nums'>
        {props.value}
      </div>
      {props.hint ? (
        <div className='text-muted-foreground mt-0.5 truncate text-[11px]'>
          {props.hint}
        </div>
      ) : null}
    </div>
  )
}

export function UsageStats() {
  const { t } = useTranslation()
  const [range, setRange] = useState(() =>
    getRollingDateRange(DEFAULT_RANGE_DAYS)
  )
  // null means the user hand-picked a range in the calendar; any number means
  // the window is on a rolling preset, so refreshing re-anchors it to "now"
  // instead of freezing the window at the moment it was clicked.
  const [rollingDays, setRollingDays] = useState<number | null>(
    DEFAULT_RANGE_DAYS
  )
  // Bumped by refresh/reset. It is part of the query key on purpose: two clicks
  // inside the same second recompute identical timestamps, and without it the
  // second click would be answered from the cache instead of hitting the API.
  const [reloadToken, setReloadToken] = useState(0)
  const [dimension, setDimension] = useState<UsageStatDimension>('model')

  const params = useMemo(
    () =>
      computeTimeRange(rollingDays ?? DEFAULT_RANGE_DAYS, range.start, range.end),
    [range, rollingDays]
  )
  const query = useQuery({
    queryKey: [
      USAGE_STAT_QUERY_KEY,
      params.start_timestamp,
      params.end_timestamp,
      reloadToken,
    ],
    queryFn: () => getUsageStat(params),
    // This page is about "what happened just now"; never serve a cached copy.
    staleTime: 0,
  })

  const handleRefresh = () => {
    if (rollingDays !== null) {
      setRange(getRollingDateRange(rollingDays))
    }
    setReloadToken((token) => token + 1)
  }

  const applyPreset = (days: number) => {
    setRollingDays(days)
    setRange(getRollingDateRange(days))
    setReloadToken((token) => token + 1)
  }

  const handleReset = () => {
    setRollingDays(DEFAULT_RANGE_DAYS)
    setRange(getRollingDateRange(DEFAULT_RANGE_DAYS))
    setReloadToken((token) => token + 1)
  }

  const result = query.data?.data
  const byModel = result?.by_model ?? []
  const byChannel = result?.by_channel ?? []
  const totals = result?.totals
  // Server-normalized: input_tokens already includes cache hits.
  const totalTokens =
    (totals?.input_tokens ?? 0) + (totals?.completion_tokens ?? 0)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Usage Stats')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5'>
          {(['model', 'channel'] as const).map((value) => (
            <button
              key={value}
              type='button'
              onClick={() => setDimension(value)}
              className={`inline-flex items-center rounded-md px-3 text-xs font-medium transition-colors ${
                dimension === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {value === 'model' ? t('By Model') : t('By Channel')}
            </button>
          ))}
        </div>
        <div className='flex items-center gap-2'>
          <div className='bg-muted/60 inline-flex h-8 items-center rounded-lg border p-0.5'>
            {PRESET_DAYS.map((days) => (
              <button
                key={days}
                type='button'
                onClick={() => applyPreset(days)}
                className={`inline-flex items-center whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors ${
                  rollingDays === days
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {days === 1 ? t('1 day') : t(`${days} days`)}
              </button>
            ))}
          </div>
          <CompactDateTimeRangePicker
            start={range.start}
            end={range.end}
            onChange={(next) => {
              setRollingDays(null)
              setRange((current) => ({
                start: next.start ?? current.start,
                end: next.end ?? current.end,
              }))
            }}
          />
        </div>
        <div className='flex items-center gap-1.5'>
          {query.dataUpdatedAt ? (
            <span className='text-muted-foreground hidden text-[11px] tabular-nums sm:block'>
              {t('Updated')} {dayjs(query.dataUpdatedAt).format('HH:mm:ss')}
            </span>
          ) : null}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleRefresh}
                  disabled={query.isFetching}
                  aria-label={t('Refresh')}
                  className='h-8 gap-1.5 px-2.5'
                />
              }
            >
              {query.isFetching ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : (
                <RefreshCw className='size-3.5' />
              )}
              <span className='text-xs'>{t('Refresh')}</span>
            </TooltipTrigger>
            <TooltipContent>{t('Refresh')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  onClick={handleReset}
                  aria-label={t('Reset')}
                  className='text-muted-foreground hover:text-foreground size-8'
                />
              }
            >
              <RotateCcw className='size-4' />
            </TooltipTrigger>
            <TooltipContent>{t('Reset to the last 24 hours')}</TooltipContent>
          </Tooltip>
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
            <SummaryCard
              label={t('Total Tokens')}
              value={formatTokens(totalTokens)}
              hint={t('All input + output')}
            />
            <SummaryCard
              label={t('Cache Hit')}
              value={formatTokens(totals?.cache_tokens ?? 0)}
              hint={t('Billed at the cache ratio')}
            />
            <SummaryCard
              label={t('Cache Hit Rate')}
              value={formatPercent((totals?.cache_hit_rate ?? 0) * 100)}
              hint={t('Cache Hit ÷ Total Input')}
            />
            <SummaryCard
              label={t('Uncached Input')}
              value={formatTokens(totals?.miss_tokens ?? 0)}
              hint={t('Billed at full input price')}
            />
            <SummaryCard
              label={t('Output')}
              value={formatTokens(totals?.completion_tokens ?? 0)}
            />
            <SummaryCard
              label={t('Cache Write')}
              value={formatTokens(totals?.cache_creation_tokens ?? 0)}
              hint={t('Billed as cache creation')}
            />
            <SummaryCard
              label={t('Requests')}
              value={formatNumber(totals?.count ?? 0)}
            />
            <SummaryCard
              label={t('Cost')}
              value={formatQuota(totals?.quota ?? 0)}
              hint={t('Relies on configured model prices')}
            />
          </div>

          <CacheHitRateChart
            items={dimension === 'model' ? byModel : byChannel}
            dimension={dimension}
            loading={query.isLoading}
          />

          <UsageStatTable
            items={dimension === 'model' ? byModel : byChannel}
            dimension={dimension}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
