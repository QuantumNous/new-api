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
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { useTheme } from '@/context/theme-provider'
import { getUserQuotaDates } from '@/features/dashboard/api'
import { MAX_CHART_TREND_POINTS } from '@/features/dashboard/constants'
import { processChartData } from '@/features/dashboard/lib'
import { getRollingDateRange } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

export function DailyOverviewPanel() {
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

  const defaultDays = MAX_CHART_TREND_POINTS
  const timeRange = useMemo(() => {
    const { start, end } = getRollingDateRange(defaultDays)
    return { start_timestamp: start, end_timestamp: end }
  }, [defaultDays])

  const chartDataQuery = useQuery({
    queryKey: ['dashboard', 'overview', 'daily-overview-chart', timeRange],
    queryFn: async () => {
      const result = await getUserQuotaDates({
        start_timestamp: timeRange.start_timestamp,
        end_timestamp: timeRange.end_timestamp,
        default_time: 'day',
      })
      return result.success ? (result.data ?? []) : []
    },
    staleTime: 60 * 1000,
  })

  const chartData = useMemo(
    () =>
      processChartData(
        chartDataQuery.isLoading ? [] : (chartDataQuery.data ?? []),
        'day',
        t
      ),
    [chartDataQuery.data, chartDataQuery.isLoading, t]
  )

  const spec = chartData.spec_daily_overview
  const hasData = (chartDataQuery.data ?? []).length > 0

  if (!hasData && chartDataQuery.isFetched) {
    return null
  }

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <IconBadge tone='chart-4' size='sm'>
          <Activity />
        </IconBadge>
        <div className='text-sm font-semibold'>{t('Daily Overview')}</div>
      </div>

      <div className='h-[300px] p-1.5 sm:h-96 sm:p-2'>
        {themeReady && spec && (
          <VChart
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
