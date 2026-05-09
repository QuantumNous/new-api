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
import { useEffect, useMemo, useState } from 'react'
import { AreaChart, BarChart3, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import type { TimeGranularity } from '@/lib/time'
import { getCurrencyDisplay } from '@/lib/currency'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import {
  CONSUMPTION_DISTRIBUTION_CHART_OPTIONS,
  DEFAULT_TIME_GRANULARITY,
} from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type {
  ConsumptionDistributionChartType,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { DashboardAreaChart } from '@/features/dashboard/components/dashboard-area-chart'
import { DashboardStackedBarChart } from '@/features/dashboard/components/dashboard-stacked-bar-chart'

const CHART_TYPE_ICONS: Record<
  ConsumptionDistributionChartType,
  typeof BarChart3
> = {
  bar: BarChart3,
  area: AreaChart,
}

interface ConsumptionDistributionChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
  defaultChartType?: ConsumptionDistributionChartType
}

export function ConsumptionDistributionChart(
  props: ConsumptionDistributionChartProps
) {
  const { t } = useTranslation()
  const { customization } = useThemeCustomization()
  const chartRadius = useThemeRadiusPx(
    '--radius-md',
    `${customization.preset}:${customization.radius}`
  )
  const [chartType, setChartType] = useState<ConsumptionDistributionChartType>(
    props.defaultChartType ?? 'bar'
  )
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY

  useEffect(() => {
    if (props.defaultChartType) setChartType(props.defaultChartType)
  }, [props.defaultChartType])

  const chartData = useMemo(
    () =>
      processChartData(
        props.loading ? [] : props.data,
        timeGranularity,
        t,
        customization.preset,
        chartRadius
      ),
    [props.data, props.loading, timeGranularity, t, customization.preset, chartRadius]
  )

  const { config: currencyConfig, meta: currencyMeta } = getCurrencyDisplay()
  const formatQuota = (v: number) => {
    if (currencyMeta.kind === 'tokens') return v.toLocaleString()
    const usd = v / currencyConfig.quotaPerUnit
    const rate = 'exchangeRate' in currencyMeta ? currencyMeta.exchangeRate : 1
    const symbol = 'symbol' in currencyMeta ? currencyMeta.symbol : '$'
    return symbol + (usd * rate).toFixed(2)
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <WalletCards className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>{t('Quota Distribution')}</div>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {chartData.totalQuotaDisplay}
          </span>
        </div>

        <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
          {CONSUMPTION_DISTRIBUTION_CHART_OPTIONS.map((item) => {
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
        {chartType === 'area' ? (
          <DashboardAreaChart
            data={chartData.area_chart_data}
            formatValue={formatQuota}
            otherLabel={t('Other')}
            totalLabel={t('Total:')}
          />
        ) : (
          <DashboardStackedBarChart
            data={chartData.stacked_bar_data}
            formatValue={formatQuota}
            otherLabel={t('Other')}
            totalLabel={t('Total:')}
          />
        )}
      </div>
    </div>
  )
}
