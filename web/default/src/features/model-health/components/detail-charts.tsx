/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatPercent } from '../lib'
import type { ModelHealthSeriesPoint } from '../types'

function timeTick(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
  }).format(new Date(timestamp * 1000))
}

export function DetailCharts(props: {
  series: ModelHealthSeriesPoint[]
  healthyThreshold: number
}) {
  const { t } = useTranslation()
  const hasTtft = useMemo(
    () => props.series.some((point) => point.avg_ttft_ms !== null),
    [props.series]
  )
  const successConfig = {
    success_rate: {
      label: t('Observed success'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig
  const latencyConfig = {
    avg_latency_ms: {
      label: t('Average duration'),
      color: 'var(--chart-1)',
    },
    avg_ttft_ms: {
      label: t('Average TTFT'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig
  const thresholdLabel = t('{{value}}% healthy threshold', {
    value: formatPercent(props.healthyThreshold),
  })

  return (
    <div className='grid gap-3 xl:grid-cols-2'>
      <Card className='gap-2 py-4'>
        <CardHeader className='px-4'>
          <CardTitle>{t('Observed success trend')}</CardTitle>
          <CardDescription>
            {t('Successful final requests by persisted bucket')} ·{' '}
            {thresholdLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className='px-2 sm:px-4'>
          <ChartContainer config={successConfig} className='h-56 w-full'>
            <LineChart
              accessibilityLayer
              data={props.series}
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='ts'
                tickLine={false}
                axisLine={false}
                minTickGap={36}
                tickFormatter={timeTick}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine
                y={props.healthyThreshold}
                stroke='var(--border)'
                strokeDasharray='4 4'
                label={{
                  value: thresholdLabel,
                  position: 'insideTopRight',
                }}
              />
              <Line
                dataKey='success_rate'
                type='monotone'
                stroke='var(--color-success_rate)'
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className='gap-2 py-4'>
        <CardHeader className='px-4'>
          <CardTitle>{t('Duration and TTFT trend')}</CardTitle>
          <CardDescription>
            {t('Milliseconds by persisted bucket')}
          </CardDescription>
        </CardHeader>
        <CardContent className='px-2 sm:px-4'>
          <ChartContainer config={latencyConfig} className='h-56 w-full'>
            <LineChart
              accessibilityLayer
              data={props.series}
              margin={{ left: 0, right: 12 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='ts'
                tickLine={false}
                axisLine={false}
                minTickGap={36}
                tickFormatter={timeTick}
              />
              <YAxis tickLine={false} axisLine={false} width={42} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey='avg_latency_ms'
                type='monotone'
                stroke='var(--color-avg_latency_ms)'
                strokeWidth={2}
                dot={false}
              />
              {hasTtft && (
                <Line
                  dataKey='avg_ttft_ms'
                  type='monotone'
                  stroke='var(--color-avg_ttft_ms)'
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              )}
            </LineChart>
          </ChartContainer>
          {!hasTtft && (
            <p className='text-muted-foreground px-2 text-xs'>
              {t(
                'TTFT is unavailable because no TTFT samples were persisted in this window.'
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
