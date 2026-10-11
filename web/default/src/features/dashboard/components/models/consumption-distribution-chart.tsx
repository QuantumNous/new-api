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
import { AreaChart, BarChart3, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useQuery } from '@tanstack/react-query'

import { IconBadge } from '@/components/ui/icon-badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { getQuotaDataDimensions } from '@/features/dashboard/api'
import {
  CONSUMPTION_DISTRIBUTION_CHART_OPTIONS,
  DEFAULT_TIME_GRANULARITY,
} from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type {
  DashboardFilters,
  ConsumptionDistributionChartType,
  QuotaDataItem,
} from '@/features/dashboard/types'
import { useAuthStore } from '@/stores/auth-store'
import { useThemeRadiusPx } from '@/lib/theme-radius'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface ConsumptionDistributionChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
  defaultChartType?: ConsumptionDistributionChartType
  filters?: DashboardFilters
  onFilterChange?: (filters: DashboardFilters) => void
}

const CHART_TYPE_ICONS: Record<
  ConsumptionDistributionChartType,
  typeof BarChart3
> = {
  bar: BarChart3,
  area: AreaChart,
}

// Sentinel for the "no filter" option, since an empty-string Select value
// collides with the unset placeholder state.
const ALL_KEY = '__all__'
const ALL_KEY_ENTRY = { value: ALL_KEY, label: 'All keys' }
const ALL_MODEL_ENTRY = { value: ALL_KEY, label: 'All models' }

export function ConsumptionDistributionChart(
  props: ConsumptionDistributionChartProps
) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const chartRadius = useThemeRadiusPx(
    '--radius-md',
    `${customization.preset}:${customization.radius}`
  )
  const [chartType, setChartType] = useState<ConsumptionDistributionChartType>(
    props.defaultChartType ?? 'bar'
  )
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY
  const inlineFilters = props.filters
  const onInlineFilterChange = props.onFilterChange
  const canFilterInline = Boolean(inlineFilters && onInlineFilterChange)
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = !!(user?.role && user.role >= 10)

  useEffect(() => {
    if (props.defaultChartType) setChartType(props.defaultChartType)
  }, [props.defaultChartType])

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)

      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }

      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }

    updateTheme()
  }, [resolvedTheme])

  const chartData = useMemo(
    () =>
      processChartData(
        props.loading ? [] : props.data,
        timeGranularity,
        t,
        chartRadius
      ),
    [props.data, props.loading, timeGranularity, t, chartRadius]
  )
  const dimsQuery = useQuery({
    queryKey: ['quota-data-dimensions', isAdmin],
    enabled: canFilterInline,
    queryFn: async () => {
      const result = await getQuotaDataDimensions(undefined, isAdmin)
      return result.data || { keys: [], models: [] }
    },
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
  const setInlineDimension = (key: 'token_name' | 'model_name', value: string) => {
    if (!inlineFilters || !onInlineFilterChange) return
    onInlineFilterChange({ ...inlineFilters, [key]: value })
  }
  const spec = chartType === 'bar' ? chartData.spec_line : chartData.spec_area
  const specType = typeof spec?.type === 'string' ? spec.type : chartType
  const chartKey = [
    chartType,
    specType,
    props.loading ? 'loading' : 'ready',
    props.data.length,
    resolvedTheme,
    customization.preset,
  ].join('-')

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='success' size='sm'>
            <WalletCards />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('Quota Distribution')}</div>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {chartData.totalQuotaDisplay}
          </span>
        </div>

        <div className='flex w-full items-center gap-2 sm:w-auto'>
          {canFilterInline && (
            <>
              <div className='bg-muted/60 inline-flex h-7 shrink-0 items-center overflow-hidden rounded-lg border p-0.5 sm:h-8'>
                <Select
                  items={[
                    ALL_KEY_ENTRY,
                    ...(dimsQuery.data?.keys ?? []).map((name) => ({
                      value: name,
                      label: name,
                    })),
                  ]}
                  value={inlineFilters?.token_name || ALL_KEY}
                  onValueChange={(value) =>
                    setInlineDimension(
                      'token_name',
                      value === ALL_KEY ? '' : value
                    )
                  }
                >
                  <SelectTrigger
                    size='sm'
                    className='max-w-[190px] border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent'
                  >
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {t('Key')}:
                    </span>
                    <SelectValue placeholder={t('All keys')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value={ALL_KEY}>{t('All keys')}</SelectItem>
                      {(dimsQuery.data?.keys ?? []).map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className='bg-muted/60 inline-flex h-7 shrink-0 items-center overflow-hidden rounded-lg border p-0.5 sm:h-8'>
                <Select
                  items={[
                    ALL_MODEL_ENTRY,
                    ...(dimsQuery.data?.models ?? []).map((name) => ({
                      value: name,
                      label: name,
                    })),
                  ]}
                  value={inlineFilters?.model_name || ALL_KEY}
                  onValueChange={(value) =>
                    setInlineDimension(
                      'model_name',
                      value === ALL_KEY ? '' : value
                    )
                  }
                >
                  <SelectTrigger
                    size='sm'
                    className='max-w-[190px] border-none bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent'
                  >
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {t('Model')}:
                    </span>
                    <SelectValue placeholder={t('All models')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value={ALL_KEY}>{t('All models')}</SelectItem>
                      {(dimsQuery.data?.models ?? []).map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className='bg-muted/60 inline-flex h-7 w-full min-w-0 flex-1 overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto sm:flex-none'>
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
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && spec && (
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
