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
import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { getRollingDateRange, type TimeGranularity } from '@/lib/time'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  TIME_GRANULARITY_OPTIONS,
  TIME_RANGE_PRESETS,
} from '@/features/dashboard/constants'
import type {
  DashboardChartPreferences,
  DashboardFilters,
} from '@/features/dashboard/types'

interface ModelsFilterProps {
  filters: DashboardFilters
  preferences: DashboardChartPreferences
  onFilterChange: (filters: DashboardFilters) => void
  onPreferencesChange: (patch: Partial<DashboardChartPreferences>) => void
  onReset: () => void
}

function granularityForRangeDays(days: number): TimeGranularity {
  if (days <= 1) return 'hour'
  if (days >= 29) return 'week'
  return 'day'
}

export function ModelsFilter(props: ModelsFilterProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = user?.role && user.role >= 10

  const [selectedRange, setSelectedRange] = useState<number | null>(
    () => props.preferences.defaultTimeRangeDays
  )

  const handleReset = () => {
    setSelectedRange(props.preferences.defaultTimeRangeDays)
    props.onReset()
  }

  const handleChange = (
    field: keyof DashboardFilters,
    value: string | undefined
  ) => {
    props.onFilterChange({ ...props.filters, [field]: value })
  }

  const handleQuickRange = (days: number) => {
    const { start, end } = getRollingDateRange(days)
    const timeGranularity = granularityForRangeDays(days)

    props.onFilterChange({
      ...props.filters,
      start_timestamp: start,
      end_timestamp: end,
      time_granularity: timeGranularity,
    })
    props.onPreferencesChange({
      defaultTimeRangeDays: days,
      defaultTimeGranularity: timeGranularity,
    })
    setSelectedRange(days)
  }

  const handleGranularityChange = (value: string) => {
    const granularity = value as TimeGranularity
    props.onFilterChange({
      ...props.filters,
      time_granularity: granularity,
    })
    props.onPreferencesChange({ defaultTimeGranularity: granularity })
  }

  return (
    <div className='flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2'>
      <Tabs
        value={String(selectedRange ?? '')}
        onValueChange={(value) => handleQuickRange(Number(value))}
        className='max-w-full shrink-0 overflow-x-auto'
      >
        <TabsList>
          {TIME_RANGE_PRESETS.map((preset) => (
            <TabsTrigger
              key={preset.days}
              value={String(preset.days)}
              className='px-2.5 text-xs'
            >
              {t(preset.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={
          props.filters.time_granularity ??
          props.preferences.defaultTimeGranularity
        }
        onValueChange={handleGranularityChange}
        className='shrink-0'
      >
        <TabsList>
          {TIME_GRANULARITY_OPTIONS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className='px-2.5 text-xs'
            >
              {t(option.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isAdmin && (
        <Input
          placeholder={t('Filter by username')}
          value={props.filters.username ?? ''}
          onChange={(event) => handleChange('username', event.target.value)}
          className='h-8 w-[160px] text-xs'
        />
      )}

      <Button
        type='button'
        variant='outline'
        size='icon'
        onClick={handleReset}
        className='size-8 shrink-0'
        aria-label={t('Reset')}
        title={t('Reset')}
      >
        <RotateCcw className='size-3.5' />
      </Button>
    </div>
  )
}
