import { Activity } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/shared/components/ui/chart'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { TitledCard } from '@/shared/components/ui/titled-card'
import { formatCompactNumber, formatInteger } from '@/shared/lib/format'

import { buildUsageTrend } from '../lib/aggregate'
import type { OverviewQuotaRow } from '../types'

export function ActivityTrendPanel({
  rows,
  now,
  loading,
  rates,
  ratesLoading,
}: {
  rows: readonly OverviewQuotaRow[]
  now: Date
  loading: boolean
  rates: { rpm: number; tpm: number } | null
  ratesLoading: boolean
}) {
  const { t } = useTranslation()
  const [range, setRange] = useState<'1' | '7' | '30'>('7')
  const points = useMemo(
    () => buildUsageTrend(rows, Number(range) as 1 | 7 | 30, now),
    [rows, range, now]
  )

  return (
    <TitledCard
      title={t('Usage')}
      description={t('Usage data may lag by a few minutes')}
      icon={<Activity className='size-5' />}
      iconTone='chart-1'
      action={
        <Tabs
          value={range}
          onValueChange={(value) => {
            if (value === '1' || value === '7' || value === '30') {
              setRange(value)
            }
          }}
        >
          <TabsList aria-label={t('Time range')}>
            <TabsTrigger value='1'>{t('Today')}</TabsTrigger>
            <TabsTrigger value='7'>{t('7 Days')}</TabsTrigger>
            <TabsTrigger value='30'>{t('30 days')}</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className='grid gap-4 lg:grid-cols-2'>
        {(['requests', 'tokens'] as const).map((metric) => {
          const label = metric === 'requests' ? t('Requests') : t('Tokens')
          const total = points.reduce((sum, point) => sum + point[metric], 0)
          const rate = metric === 'requests' ? rates?.rpm : rates?.tpm
          const rateLabel =
            metric === 'requests'
              ? t('Requests per minute')
              : t('Tokens per minute')
          let rateValue = '—'
          if (ratesLoading) {
            rateValue = '…'
          } else if (rate != null && Number.isFinite(rate)) {
            rateValue = formatInteger(rate)
          }
          const config: ChartConfig = {
            [metric]: {
              label,
              color:
                metric === 'requests' ? 'var(--chart-1)' : 'var(--chart-3)',
            },
          }
          return (
            <div
              key={metric}
              className='bg-muted/30 min-w-0 rounded-xl border p-4'
            >
              <div className='text-muted-foreground text-sm font-medium'>
                {label}
              </div>
              {loading ? (
                <Skeleton className='mt-2 h-8 w-24' />
              ) : (
                <div className='mt-1 text-2xl font-semibold tracking-tight tabular-nums'>
                  {formatInteger(total)}
                </div>
              )}
              <div className='text-muted-foreground mt-2 text-xs'>
                {rateLabel}: {rateValue}
              </div>
              <div className='mt-4 h-36'>
                {loading && <Skeleton className='h-full w-full' />}
                {!loading && total === 0 && (
                  <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
                    {t('No data available')}
                  </div>
                )}
                {!loading && total > 0 && (
                  <ChartContainer
                    config={config}
                    className='aspect-auto h-full w-full'
                  >
                    <AreaChart
                      data={points}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray='3 3' />
                      <XAxis
                        dataKey='label'
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                        tickMargin={8}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={42}
                        allowDecimals={false}
                        tickFormatter={(value) =>
                          formatCompactNumber(Number(value))
                        }
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type='monotone'
                        dataKey={metric}
                        stroke={`var(--color-${metric})`}
                        fill={`var(--color-${metric})`}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </TitledCard>
  )
}
