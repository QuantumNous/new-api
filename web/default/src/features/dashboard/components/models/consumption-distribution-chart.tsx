import { useEffect, useMemo, useRef, useState } from 'react'
import { VChart } from '@visactor/react-vchart'
import { AreaChart, BarChart3, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useTheme } from '@/context/theme-provider'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type { QuotaDataItem } from '@/features/dashboard/types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type DistributionChartType = 'bar' | 'area'

interface ConsumptionDistributionChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

const CHART_TYPES: Array<{
  value: DistributionChartType
  labelKey: string
  icon: typeof BarChart3
}> = [
  { value: 'bar', labelKey: 'Bar Chart', icon: BarChart3 },
  { value: 'area', labelKey: 'Area Chart', icon: AreaChart },
]

export function ConsumptionDistributionChart(
  props: ConsumptionDistributionChartProps
) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [chartType, setChartType] = useState<DistributionChartType>('bar')
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)
  const timeGranularity = props.timeGranularity ?? DEFAULT_TIME_GRANULARITY

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
    () => processChartData(props.loading ? [] : props.data, timeGranularity, t),
    [props.data, props.loading, timeGranularity, t]
  )
  const spec = chartType === 'bar' ? chartData.spec_line : chartData.spec_area

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-3 border-b px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <WalletCards className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>
            {t('Quota Distribution')}
          </div>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {chartData.totalQuotaDisplay}
          </span>
        </div>

        <div className='bg-muted/60 inline-flex h-8 rounded-md border p-0.5'>
          {CHART_TYPES.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.value}
                type='button'
                onClick={() => setChartType(item.value)}
                className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 text-xs font-medium transition-colors ${
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

      <div className='h-96 p-2'>
        {themeReady && spec && (
          <VChart
            key={`${chartType}-${resolvedTheme}`}
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
