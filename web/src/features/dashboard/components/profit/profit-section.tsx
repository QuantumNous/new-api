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
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FadeIn } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'

import { getChannelProfit } from '@/features/dashboard/api'

import { ChannelProfitTable } from './channel-profit-table'
import { ModelProfitChart } from './model-profit-chart'
import { ProfitSummaryCards } from './profit-summary-cards'

export function ProfitSection() {
  const { t } = useTranslation()
  const [selectedRange, setSelectedRange] = useState(29)
  const [granularity, setGranularity] = useState<TimeGranularity>('day')

  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(selectedRange)
    return {
      start_timestamp: Math.floor(start.getTime() / 1000),
      end_timestamp: Math.floor(end.getTime() / 1000),
    }
  }, [selectedRange])

  const { data, isLoading } = useQuery({
    queryKey: ['channel-profit', timeRange.start_timestamp, timeRange.end_timestamp, granularity],
    queryFn: () =>
      getChannelProfit({
        start_timestamp: timeRange.start_timestamp,
        end_timestamp: timeRange.end_timestamp,
        granularity,
      }),
  })

  return (
    <div className='space-y-3 sm:space-y-4'>
      <div className='flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2'>
        <Tabs
          value={String(selectedRange)}
          onValueChange={(value) => setSelectedRange(Number(value))}
          className='shrink-0'
        >
          <TabsList>
            {TIME_RANGE_PRESETS.map((preset) => (
              <TabsTrigger
                key={preset.days}
                value={String(preset.days)}
                className='px-2.5 text-xs'
              >
                {t(preset.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Tabs
          value={granularity}
          onValueChange={(value) => setGranularity(value as TimeGranularity)}
          className='shrink-0'
        >
          <TabsList>
            {TIME_GRANULARITY_OPTIONS.map((opt) => (
              <TabsTrigger
                key={opt.value}
                value={opt.value}
                className='px-2.5 text-xs'
              >
                {t(opt.label)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      <FadeIn>
        <ProfitSummaryCards
          summary={data?.data.summary}
          loading={isLoading}
        />
      </FadeIn>
      <FadeIn delay={0.05}>
        <ChannelProfitTable rows={data?.data.by_channel} loading={isLoading} />
      </FadeIn>
      <FadeIn delay={0.1}>
        {isLoading ? (
          <Skeleton className='h-72 w-full' />
        ) : (
          <ModelProfitChart
            rows={data?.data.by_model ?? []}
            trend={data?.data.trend ?? []}
            granularity={granularity}
          />
        )}
      </FadeIn>
    </div>
  )
}
