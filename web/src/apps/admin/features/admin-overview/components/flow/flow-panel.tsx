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
import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { ModelsFilter } from '@/apps/client/features/dashboard/components/models/models-filter-dialog'
import {
  buildDefaultDashboardFilters,
  getSavedChartPreferences,
} from '@/apps/client/features/dashboard/lib'
import type {
  DashboardChartPreferences,
  DashboardFilters,
} from '@/apps/client/features/dashboard/types'

import { FlowCharts } from './flow-charts'

// The flow panel keeps its filter state local so reopening the page starts
// from the saved preferences instead of leaking selections across panels.
export function FlowPanel() {
  const { t } = useTranslation()
  // The saved preferences only seed the filter dialog defaults; the dialog has
  // no preference editor, so the snapshot is read once and never rewritten.
  const [chartPreferences] = useState<DashboardChartPreferences>(() =>
    getSavedChartPreferences()
  )
  const [modelFilters, setModelFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(getSavedChartPreferences())
  )
  const [sensitiveVisible, setSensitiveVisible] = useState(true)

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters(buildDefaultDashboardFilters(chartPreferences))
  }, [chartPreferences])

  return (
    <div className='flex flex-col gap-3 sm:gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-1.5 sm:gap-2'>
        <div />
        <div className='flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2'>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setSensitiveVisible((prev) => !prev)}
                  aria-label={
                    sensitiveVisible
                      ? t('Hide sensitive data')
                      : t('Show sensitive data')
                  }
                  className='text-muted-foreground hover:text-foreground size-8'
                />
              }
            >
              {sensitiveVisible ? <Eye /> : <EyeOff />}
            </TooltipTrigger>
            <TooltipContent>
              {sensitiveVisible
                ? t('Hide sensitive data')
                : t('Show sensitive data')}
            </TooltipContent>
          </Tooltip>
          <ModelsFilter
            preferences={chartPreferences}
            currentFilters={modelFilters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            titleKey='Flow Filters'
            descriptionKey='Filter the traffic flow view by time range and user.'
          />
        </div>
      </div>
      <FlowCharts filters={modelFilters} sensitiveVisible={sensitiveVisible} />
    </div>
  )
}
