import { useEffect, useMemo, useState, useRef } from 'react'
import { VChart } from '@visactor/react-vchart'
import { PieChart as PieChartIcon } from 'lucide-react'
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

type ChartTab = 'trend' | 'proportion' | 'top'
type ChartSpecKey = 'spec_model_line' | 'spec_pie' | 'spec_rank_bar'

const CHART_TABS: {
  value: ChartTab
  labelKey: string
  specKey: ChartSpecKey
}[] = [
  { value: 'trend', labelKey: 'Call Trend', specKey: 'spec_model_line' },
  {
    value: 'proportion',
    labelKey: 'Call Count Distribution',
    specKey: 'spec_pie',
  },
  { value: 'top', labelKey: 'Call Count Ranking', specKey: 'spec_rank_bar' },
]

interface ModelChartsProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

export function ModelCharts(props: ModelChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<ChartTab>('trend')
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

  const activeSpec = CHART_TABS.find((tab) => tab.value === activeTab)
  const spec = activeSpec ? chartData[activeSpec.specKey] : null

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-3 border-b px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <PieChartIcon className='text-muted-foreground/60 size-4' />
          <div className='text-sm font-semibold'>
            {t('Model Call Analytics')}
          </div>
          <span className='text-muted-foreground text-xs'>
            {t('Total:')} {chartData.totalCountDisplay}
          </span>
        </div>

        <div className='bg-muted/60 inline-flex h-8 rounded-md border p-0.5'>
          {CHART_TABS.map((tab) => (
            <button
              key={tab.value}
              type='button'
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-[5px] px-3 text-xs font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className='h-96 p-2'>
        {themeReady && spec && (
          <VChart
            key={`${activeTab}-${resolvedTheme}`}
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
