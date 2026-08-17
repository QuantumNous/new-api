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
import { VChart } from '@visactor/react-vchart'
import { AreaChart, BarChart3, PieChart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { formatQuota } from '@/lib/format'
import { useChartTheme } from '@/lib/use-chart-theme'
import { VCHART_OPTION } from '@/lib/vchart'

import type { ChannelProfitRow } from '@/features/dashboard/types'

const PROFIT_POSITIVE_COLOR = '#5AD8A6'
const PROFIT_NEGATIVE_COLOR = '#E8684A'

type ProfitChartType = 'bar' | 'area' | 'pie'

const CHART_TYPE_ICONS: Record<ProfitChartType, typeof BarChart3> = {
  bar: BarChart3,
  area: AreaChart,
  pie: PieChart,
}

const CHART_OPTIONS: { value: ProfitChartType; labelKey: string }[] = [
  { value: 'bar', labelKey: 'Bar Chart' },
  { value: 'area', labelKey: 'Area Chart' },
  { value: 'pie', labelKey: 'Pie Chart' },
]

export function ModelProfitChart(props: { rows?: ChannelProfitRow[] }) {
  const { t } = useTranslation()
  const { resolvedTheme, themeReady } = useChartTheme()
  const [chartType, setChartType] = useState<ProfitChartType>('bar')

  const spec = useMemo(() => {
    const rows = props.rows ?? []
    const topupLabel = t('Topup')
    const values = rows.map((row) => ({
      Model: row.model_name || topupLabel,
      Profit: row.profit,
      ProfitAbs: Math.abs(row.profit),
    }))
    const colorMap: Record<string, string> = {}
    for (const row of rows) {
      colorMap[row.model_name || topupLabel] =
        row.profit >= 0 ? PROFIT_POSITIVE_COLOR : PROFIT_NEGATIVE_COLOR
    }
    const common = {
      data: [{ id: 'modelProfitData', values }],
      legends: { visible: false },
      tooltip: {
        mark: {
          content: [
            {
              key: (datum: Record<string, unknown>) => datum?.Model,
              value: (datum: Record<string, unknown>) =>
                formatQuota(Number(datum?.Profit ?? 0)),
            },
          ],
        },
      },
      background: { fill: 'transparent' },
      animation: true,
    }
    if (chartType === 'pie') {
      return {
        ...common,
        type: 'pie',
        categoryField: 'Model',
        valueField: 'ProfitAbs',
        title: {
          visible: true,
          text: t('By Model'),
          ...(values.length === 0 && { subtext: t('No data available') }),
        },
        color: { specified: colorMap },
        label: {
          visible: true,
          style: { fontSize: 11 },
          formatMethod: (value: number) => formatQuota(value),
        },
        pie: {
          state: { hover: { stroke: '#000', lineWidth: 1 } },
        },
      }
    }
    if (chartType === 'area') {
      return {
        ...common,
        type: 'area',
        xField: 'Model',
        yField: 'Profit',
        direction: 'horizontal',
        title: {
          visible: true,
          text: t('By Model'),
          ...(values.length === 0 && { subtext: t('No data available') }),
        },
        color: { specified: colorMap },
        label: {
          visible: true,
          style: { fontSize: 11 },
          formatMethod: (value: number) => formatQuota(value),
        },
        axes: [
          { orient: 'left', type: 'band' },
          { orient: 'bottom', type: 'linear', visible: false },
        ],
      }
    }
    return {
      ...common,
      type: 'bar',
      xField: 'Profit',
      yField: 'Model',
      seriesField: 'Model',
      direction: 'horizontal',
      title: {
        visible: true,
        text: t('By Model'),
        ...(values.length === 0 && { subtext: t('No data available') }),
      },
      color: { specified: colorMap },
      bar: {
        state: { hover: { stroke: '#000', lineWidth: 1 } },
      },
      label: {
        visible: true,
        position: 'outside',
        style: { fontSize: 11 },
        formatMethod: (value: number) => formatQuota(value),
      },
      axes: [
        { orient: 'left', type: 'band' },
        { orient: 'bottom', type: 'linear', visible: false },
      ],
    }
  }, [props.rows, chartType, t])

  const chartKey = [chartType, props.rows?.length ?? 0, resolvedTheme].join('-')

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='chart-2' size='sm'>
            <BarChart3 />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('By Model')}</div>
        </div>

        <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
          {CHART_OPTIONS.map((item) => {
            const Icon = CHART_TYPE_ICONS[item.value]
            return (
              <button
                key={item.value}
                type='button'
                onClick={() => setChartType(item.value)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                  chartType === item.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className='size-3.5' />
                {t(item.labelKey)}
              </button>
            )
          })}
        </div>
      </div>
      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && (
          <VChart
            key={chartKey}
            spec={{
              ...spec,
              theme: resolvedTheme === 'dark' ? 'dark' : 'light',
              background: 'transparent',
            }}
            option={VCHART_OPTION}
          />
        )}
      </div>
    </div>
  )
}
