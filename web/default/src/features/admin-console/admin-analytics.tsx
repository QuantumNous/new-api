/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { useCallback, useState } from 'react'

import { DimensionUsageChart } from '@/features/admin-console/components/dimension-usage-chart'
import { FlowCharts } from '@/features/dashboard/components/flow/flow-charts'
import { ConsumptionDistributionChart } from '@/features/dashboard/components/models/consumption-distribution-chart'
import { LogStatCards } from '@/features/dashboard/components/models/log-stat-cards'
import { ModelCharts } from '@/features/dashboard/components/models/model-charts'
import { UserCharts } from '@/features/dashboard/components/users/user-charts'
import { DEFAULT_TIME_GRANULARITY } from '@/features/dashboard/constants'
import {
  buildDefaultDashboardFilters,
  getDefaultDays,
  getSavedGranularity,
} from '@/features/dashboard/lib'
import type {
  DashboardFilters,
  QuotaDataItem,
  UserChartsFilters,
} from '@/features/dashboard/types'

export type AdminAnalyticsSection = 'overview' | 'flow'

interface AdminAnalyticsProps {
  section: AdminAnalyticsSection
}

export function AdminAnalytics(props: AdminAnalyticsProps) {
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [modelFilters, setModelFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters()
  )
  const [userChartsFilters, setUserChartsFilters] = useState<UserChartsFilters>(
    () => {
      const timeGranularity = getSavedGranularity()
      return {
        timeGranularity,
        selectedRange: getDefaultDays(timeGranularity),
        topUserLimit: 10,
      }
    }
  )
  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  return (
    <div className='space-y-3 sm:space-y-4'>
      {props.section === 'overview' && (
        <LogStatCards
          filters={modelFilters}
          onDataUpdate={handleDataUpdate}
        />
      )}

      {props.section === 'overview' && (
        <div className='grid gap-3 md:grid-cols-2'>
          <ConsumptionDistributionChart
            data={modelData}
            loading={dataLoading}
            filters={modelFilters}
            onFilterChange={setModelFilters}
            timeGranularity={
              modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
            }
          />
          <ModelCharts
            data={modelData}
            loading={dataLoading}
            timeGranularity={
              modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
            }
          />
          <DimensionUsageChart
            title='分组用量'
            dimension='group'
            data={modelData}
            loading={dataLoading}
            timeGranularity={
              modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
            }
          />
          <DimensionUsageChart
            title='渠道用量'
            dimension='channel'
            data={modelData}
            loading={dataLoading}
            timeGranularity={
              modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
            }
          />
          <UserCharts
            filters={userChartsFilters}
            onFiltersChange={setUserChartsFilters}
          />
        </div>
      )}

      {props.section === 'flow' && (
        <FlowCharts
          filters={modelFilters}
          sensitiveVisible
        />
      )}
    </div>
  )
}
