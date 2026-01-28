import { useEffect, useMemo, useState, useRef } from 'react'
import { VChart } from '@visactor/react-vchart'
import { PieChart as PieChartIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useTheme } from '@/context/theme-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import type {
  ProcessedChartData,
  QuotaDataItem,
} from '@/features/dashboard/types'

// Cache ThemeManager import to avoid repeated dynamic imports
let themeManagerPromise: Promise<typeof import('@visactor/vchart')['ThemeManager']> | null = null

type ChartTab = '1' | '2' | '3' | '4'

const CHART_TABS: {
  value: ChartTab
  labelKey: string
  specKey: keyof ProcessedChartData
}[] = [
  { value: '1', labelKey: 'Quota Distribution', specKey: 'spec_line' },
  { value: '2', labelKey: 'Call Trend', specKey: 'spec_model_line' },
  { value: '3', labelKey: 'Call Proportion', specKey: 'spec_pie' },
  { value: '4', labelKey: 'Top Models', specKey: 'spec_rank_bar' },
]

interface ModelChartsProps {
  data: QuotaDataItem[]
  loading?: boolean
  timeGranularity?: TimeGranularity
}

export function ModelCharts({
  data,
  loading = false,
  timeGranularity = DEFAULT_TIME_GRANULARITY,
}: ModelChartsProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<ChartTab>('1')
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<typeof import('@visactor/vchart')['ThemeManager'] | null>(null)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      
      // Use cached promise or create new one
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then((m) => m.ThemeManager)
      }
      
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    
    updateTheme()
  }, [resolvedTheme])

  const chartData = useMemo(
    () => processChartData(loading ? [] : data, timeGranularity, t),
    [data, loading, timeGranularity, t]
  )

  const activeSpec = CHART_TABS.find((tab) => tab.value === activeTab)
  const spec = activeSpec ? chartData[activeSpec.specKey] : null

  return (
    <Card className='!gap-0 !rounded-2xl !py-0'>
      <div className='flex w-full flex-col gap-3 px-6 pt-6 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <PieChartIcon className='h-4 w-4' />
          <div className='leading-none font-semibold'>
            {t('Model Analytics')}
          </div>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as ChartTab)}
        >
          <TabsList>
            {CHART_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <CardContent className='px-0 pt-0'>
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
      </CardContent>
    </Card>
  )
}
