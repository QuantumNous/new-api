import { useEffect, useMemo, useRef, useState } from 'react'
import { VChart } from '@visactor/react-vchart'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import { processModelTokenChartData } from '@/features/dashboard/lib'
import type { QuotaDataItem } from '@/features/dashboard/types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface ModelTokenChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

export function ModelTokenChart(props: ModelTokenChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
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
    () =>
      processModelTokenChartData(
        props.loading ? [] : props.data,
        timeGranularity,
        t,
        customization.preset
      ),
    [props.data, props.loading, timeGranularity, t, customization.preset]
  )

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <Coins className='text-muted-foreground/60 size-4' />
        <div className='text-sm font-semibold'>
          {t('Model Token Trend')}
        </div>
        <span className='text-muted-foreground text-xs'>
          {t('Total:')} {chartData.totalTokensDisplay}
        </span>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && chartData.spec && (
          <VChart
            key={`model-token-${resolvedTheme}-${customization.preset}`}
            spec={{
              ...chartData.spec,
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
