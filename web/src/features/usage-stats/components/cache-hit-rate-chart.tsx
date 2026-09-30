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
import { BarChart3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { useTheme } from '@/context/theme-provider'
import { VCHART_OPTION } from '@/lib/vchart'

import type { UsageStatDimension, UsageStatItem } from '../types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

type CacheHitRateChartProps = {
  items: UsageStatItem[]
  dimension: UsageStatDimension
  onDimensionChange: (dimension: UsageStatDimension) => void
  loading?: boolean
}

export function CacheHitRateChart(props: CacheHitRateChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

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

  const dimensionLabel = (item: UsageStatItem) =>
    props.dimension === 'model'
      ? item.model_name || t('Unknown')
      : item.channel_name || `channel-${item.channel_id ?? 0}`

  const values = useMemo(() => {
    if (props.loading) return []
    return [...props.items]
      .filter((item) => item.prompt_tokens + item.cache_tokens > 0)
      .sort((a, b) => b.cache_hit_rate - a.cache_hit_rate)
      .slice(0, 12)
      .map((item) => ({
        label: dimensionLabel(item),
        hitRate: Number(((item.cache_hit_rate ?? 0) * 100).toFixed(2)),
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.items, props.loading, props.dimension, t])

  const spec = {
    type: 'bar',
    data: [{ id: 'cacheHitRate', values }],
    xField: 'label',
    yField: 'hitRate',
    seriesField: 'label',
    legends: { visible: false },
    axes: [
      {
        orient: 'bottom',
        label: { autoRotate: true, autoHide: true },
      },
      {
        orient: 'left',
        title: { visible: true, text: t('Cache Hit Rate (%)') },
      },
    ],
    title: { visible: false },
  }
  const chartKey = [
    props.dimension,
    props.loading ? 'loading' : 'ready',
    values.length,
    resolvedTheme,
  ].join('-')

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='success' size='sm'>
            <BarChart3 />
          </IconBadge>
          <div className='text-sm font-semibold'>{t('Cache Hit Rate')}</div>
        </div>
        <div className='bg-muted/60 inline-flex h-7 w-full overflow-x-auto rounded-lg border p-0.5 sm:h-8 sm:w-auto'>
          {(['model', 'channel'] as const).map((value) => (
            <button
              key={value}
              type='button'
              onClick={() => props.onDimensionChange(value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors ${
                props.dimension === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {value === 'model' ? t('By Model') : t('By Channel')}
            </button>
          ))}
        </div>
      </div>
      <div className='h-[280px] p-1.5 sm:h-80 sm:p-2'>
        {themeReady && values.length > 0 && (
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
        {themeReady && values.length === 0 && (
          <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
            {t('No usage in this time range')}
          </div>
        )}
      </div>
    </div>
  )
}
