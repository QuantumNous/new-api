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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
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

const DEFAULT_RANGE_DAYS = 7

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
  const [dimension, setDimension] = useState<UsageStatDimension>('model')

  const params = useMemo(
    () => computeTimeRange(DEFAULT_RANGE_DAYS, range.start, range.end),
    [range]
  )
  const query = useQuery({
    queryKey: ['usage-stat', params.start_timestamp, params.end_timestamp],
    queryFn: () => getUsageStat(params),
  })

  const result = query.data?.data
  const byModel = result?.by_model ?? []
  const byChannel = result?.by_channel ?? []
  const totals = result?.totals
  // Everything the upstream billed for: uncached input, cache reads, cache
  // writes and output. The four buckets are disjoint.
  const totalTokens =
    (totals?.prompt_tokens ?? 0) +
    (totals?.cache_tokens ?? 0) +
    (totals?.cache_creation_tokens ?? 0) +
    (totals?.completion_tokens ?? 0)

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Usage Stats')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <CompactDateTimeRangePicker
          start={range.start}
          end={range.end}
          onChange={(next) =>
            setRange((current) => ({
              start: next.start ?? current.start,
              end: next.end ?? current.end,
            }))
          }
        />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-3'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
            <SummaryCard
              label={t('Cost')}
              value={formatQuota(totals?.quota ?? 0)}
            />
            <SummaryCard
              label={t('Requests')}
              value={formatNumber(totals?.count ?? 0)}
            />
            <SummaryCard
              label={t('Total Tokens')}
              value={formatTokens(totalTokens)}
              hint={t('All input + output')}
            />
            <SummaryCard
              label={t('Output')}
              value={formatTokens(totals?.completion_tokens ?? 0)}
            />
            <SummaryCard
              label={t('Uncached Input')}
              value={formatTokens(totals?.prompt_tokens ?? 0)}
              hint={t('Billed at full input price')}
            />
            <SummaryCard
              label={t('Cache Hit')}
              value={formatTokens(totals?.cache_tokens ?? 0)}
              hint={t('Billed at the cache ratio')}
            />
            <SummaryCard
              label={t('Cache Write')}
              value={formatTokens(totals?.cache_creation_tokens ?? 0)}
              hint={t('Billed as cache creation')}
            />
            <SummaryCard
              label={t('Cache Hit Rate')}
              value={formatPercent((totals?.cache_hit_rate ?? 0) * 100)}
              hint={t('Cache Hit ÷ (Uncached Input + Cache Hit)')}
            />
          </div>

          <CacheHitRateChart
            items={dimension === 'model' ? byModel : byChannel}
            dimension={dimension}
            onDimensionChange={setDimension}
            loading={query.isLoading}
          />

          <div className='flex flex-col gap-2'>
            <div className='text-sm font-semibold'>{t('By Model')}</div>
            <UsageStatTable
              items={byModel}
              dimension='model'
              isLoading={query.isLoading}
              isFetching={query.isFetching}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <div className='text-sm font-semibold'>{t('By Channel')}</div>
            <UsageStatTable
              items={byChannel}
              dimension='channel'
              isLoading={query.isLoading}
              isFetching={query.isFetching}
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
