import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VChart } from '@visactor/react-vchart'
import { Coins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TimeGranularity } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { Skeleton } from '@/components/ui/skeleton'
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

  // 每个模型是否隐藏
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set())

  const toggleModel = useCallback((model: string) => {
    setHiddenModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }, [])

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

  // 当模型列表变化时，重置隐藏状态
  useEffect(() => {
    setHiddenModels(new Set())
  }, [chartData.models.join(',')])

  // 根据隐藏列表过滤数据
  const filteredSpec = useMemo(() => {
    if (!chartData.spec?.data?.[0]) return chartData.spec
    const allValues = chartData.spec.data[0].values as Array<{ Model: string }>
    const values =
      hiddenModels.size > 0
        ? allValues.filter((v) => !hiddenModels.has(v.Model))
        : allValues
    return {
      ...chartData.spec,
      data: [{ ...chartData.spec.data[0], values }],
    }
  }, [chartData.spec, hiddenModels])

  const cacheHitLabel = t('Input (Cache Hit)')
  const cacheMissLabel = t('Input (Cache Miss)')
  const outputLabel = t('Output Tokens')

  return (
    <div className='overflow-hidden rounded-lg border'>
      {/* 标题栏 */}
      <div className='flex w-full items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <Coins className='text-muted-foreground/60 size-4' />
        <div className='text-sm font-semibold'>{t('Model Token Trend')}</div>
        <span className='text-muted-foreground text-xs'>
          {t('Total:')} {chartData.totalTokensDisplay}
        </span>
      </div>

      {/* 图表区 */}
      <div className='h-[300px] p-1.5 sm:h-80 sm:p-2'>
        {props.loading ? (
          <Skeleton className='h-full w-full' />
        ) : (
          themeReady &&
          filteredSpec && (
            <VChart
              key={`model-token-${resolvedTheme}-${customization.preset}`}
              spec={{
                ...filteredSpec,
                theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                background: 'transparent',
              }}
              option={VCHART_OPTION}
            />
          )
        )}
      </div>

      {/* 自定义图例：每个模型一行，三段色块 + 模型名 */}
      {!props.loading && chartData.models.length > 0 && (
        <div className='border-t px-3 py-2 sm:px-5 sm:py-3'>
          {/* 色块说明行 */}
          <div className='mb-2 flex items-center gap-3 text-xs text-muted-foreground'>
            <div className='flex items-center gap-1'>
              <span className='inline-block h-2.5 w-3.5 rounded-sm bg-slate-300 opacity-70' />
              {cacheHitLabel}
            </div>
            <div className='flex items-center gap-1'>
              <span className='inline-block h-2.5 w-3.5 rounded-sm bg-slate-400 opacity-70' />
              {cacheMissLabel}
            </div>
            <div className='flex items-center gap-1'>
              <span className='inline-block h-2.5 w-3.5 rounded-sm bg-slate-600 opacity-70' />
              {outputLabel}
            </div>
          </div>
          {/* 模型列表 */}
          <div className='flex flex-wrap gap-x-4 gap-y-1.5'>
            {chartData.models.map((model) => {
              const entry = chartData.modelColorMap[model]
              if (!entry) return null
              const [hitColor, missColor, outColor] = entry.variants
              const hidden = hiddenModels.has(model)

              return (
                <button
                  key={model}
                  type='button'
                  onClick={() => toggleModel(model)}
                  className={`flex items-center gap-1.5 text-xs transition-opacity ${
                    hidden ? 'opacity-35' : 'opacity-100'
                  }`}
                >
                  {/* 三段色块 */}
                  <span className='flex items-center gap-px'>
                    <span
                      style={{ background: hitColor }}
                      className='inline-block h-3 w-2.5 rounded-l-sm'
                    />
                    <span
                      style={{ background: missColor }}
                      className='inline-block h-3 w-2.5'
                    />
                    <span
                      style={{ background: outColor }}
                      className='inline-block h-3 w-2.5 rounded-r-sm'
                    />
                  </span>
                  <span
                    className={`text-foreground/80 max-w-[180px] truncate ${
                      hidden ? 'line-through' : ''
                    }`}
                    title={model}
                  >
                    {model}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
