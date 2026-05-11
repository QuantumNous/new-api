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
import { useState, useCallback, useMemo, lazy, Suspense } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { ModelsChartPreferences } from './components/models/models-chart-preferences'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { OverviewDashboard } from './components/overview/overview-dashboard'
import { DEFAULT_TIME_GRANULARITY } from './constants'
import {
  buildDefaultDashboardFilters,
  getSavedChartPreferences,
  saveChartPreferences,
} from './lib'
import {
  type DashboardSectionId,
  DASHBOARD_DEFAULT_SECTION,
  DASHBOARD_SECTION_IDS,
} from './section-registry'
import {
  type DashboardChartPreferences,
  type DashboardFilters,
  type QuotaDataItem,
} from './types'

const route = getRouteApi('/_authenticated/dashboard/$section')

const LazyLogStatCards = lazy(() =>
  import('./components/models/log-stat-cards').then((m) => ({
    default: m.LogStatCards,
  }))
)

const LazyModelCharts = lazy(() =>
  import('./components/models/model-charts').then((m) => ({
    default: m.ModelCharts,
  }))
)

const LazyConsumptionDistributionChart = lazy(() =>
  import('./components/models/consumption-distribution-chart').then((m) => ({
    default: m.ConsumptionDistributionChart,
  }))
)

const LazyPerformanceOverview = lazy(() =>
  import('./components/models/performance-overview').then((m) => ({
    default: m.PerformanceOverview,
  }))
)

const LazyUserCharts = lazy(() =>
  import('./components/users/user-charts').then((m) => ({
    default: m.UserCharts,
  }))
)

function LogStatCardsFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className='px-4 py-3.5 sm:px-5 sm:py-4'>
            <Skeleton className='h-3.5 w-16' />
            <Skeleton className='mt-2 h-7 w-20' />
            <Skeleton className='mt-1.5 h-3.5 w-28' />
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelChartsFallback() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
        <Skeleton className='h-5 w-32' />
        <Skeleton className='h-8 w-72' />
      </div>
      <div className='h-96 p-2'>
        <Skeleton className='h-full w-full' />
      </div>
    </div>
  )
}

function PerformanceOverviewFallback() {
  return (
    <div className='space-y-3 sm:space-y-4'>
      <div className='overflow-hidden rounded-lg border'>
        <div className='divide-border/60 grid grid-cols-2 divide-x sm:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className='px-3 py-2.5 sm:px-5 sm:py-4'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='mt-2 h-7 w-20' />
              <Skeleton className='mt-1.5 h-3.5 w-28' />
            </div>
          ))}
        </div>
      </div>
      <div className='overflow-hidden rounded-lg border'>
        <div className='flex items-center justify-between border-b px-4 py-3 sm:px-5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-4 w-48' />
        </div>
        <Skeleton className='h-44 w-full' />
      </div>
    </div>
  )
}

const SECTION_META: Record<
  DashboardSectionId,
  { titleKey: string; descriptionKey: string }
> = {
  overview: {
    titleKey: 'Overview',
    descriptionKey: 'View dashboard overview and statistics',
  },
  models: {
    titleKey: 'Model Call Analytics',
    descriptionKey: 'View model call count analytics and charts',
  },
  users: {
    titleKey: 'User Analytics',
    descriptionKey: 'View user consumption statistics and charts',
  },
}

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const userRole = useAuthStore((state) => state.auth.user?.role)
  const activeSection = (params.section ??
    DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [chartPreferences, setChartPreferences] =
    useState<DashboardChartPreferences>(() => getSavedChartPreferences())
  const [modelFilters, setModelFilters] = useState<DashboardFilters>(() =>
    buildDefaultDashboardFilters(getSavedChartPreferences())
  )

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters(buildDefaultDashboardFilters(chartPreferences))
  }, [chartPreferences])

  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  const handleChartPreferencesChange = useCallback(
    (preferences: DashboardChartPreferences) => {
      setChartPreferences(preferences)
      setModelFilters(buildDefaultDashboardFilters(preferences))
      saveChartPreferences(preferences)
    },
    []
  )

  const meta = SECTION_META[activeSection] ?? SECTION_META.overview
  const isAdmin = Boolean(userRole && userRole >= ROLE.ADMIN)
  const visibleSections = useMemo(
    () =>
      DASHBOARD_SECTION_IDS.filter(
        (section) => section !== 'overview' && (section !== 'users' || isAdmin)
      ),
    [isAdmin]
  )
  const handleSectionChange = useCallback(
    (section: string) => {
      void navigate({
        to: '/dashboard/$section',
        params: { section: section as DashboardSectionId },
      })
    },
    [navigate]
  )
  const showSectionTabs =
    activeSection !== 'overview' && visibleSections.length > 1
  const modelActions =
    activeSection === 'models' ? (
      <>
        <ModelsChartPreferences
          preferences={chartPreferences}
          onPreferencesChange={handleChartPreferencesChange}
        />
        <ModelsFilter
          preferences={chartPreferences}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />
      </>
    ) : null

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t(meta.titleKey)}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t(meta.descriptionKey)}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          {activeSection !== 'overview' && (
            <div className='flex flex-wrap items-center justify-between gap-1.5 sm:gap-2'>
              {showSectionTabs ? (
                <Tabs value={activeSection} onValueChange={handleSectionChange}>
                  <TabsList className='h-auto max-w-full flex-wrap justify-start'>
                    {visibleSections.map((section) => (
                      <TabsTrigger key={section} value={section}>
                        {t(SECTION_META[section].titleKey)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              ) : (
                <div />
              )}
              {modelActions != null && (
                <div className='flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2'>
                  {modelActions}
                </div>
              )}
            </div>
          )}
          {activeSection === 'overview' && <OverviewDashboard />}
          {activeSection === 'models' && (
            <>
              <FadeIn>
                <Suspense fallback={<LogStatCardsFallback />}>
                  <LazyLogStatCards
                    filters={modelFilters}
                    onDataUpdate={handleDataUpdate}
                  />
                </Suspense>
              </FadeIn>
              <FadeIn delay={0.1}>
                <Suspense fallback={<PerformanceOverviewFallback />}>
                  <LazyPerformanceOverview />
                </Suspense>
              </FadeIn>
              <FadeIn delay={0.15}>
                <Suspense fallback={<ModelChartsFallback />}>
                  <LazyConsumptionDistributionChart
                    data={modelData}
                    loading={dataLoading}
                    defaultChartType={
                      chartPreferences.consumptionDistributionChart
                    }
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </FadeIn>
              <FadeIn delay={0.2}>
                <Suspense fallback={<ModelChartsFallback />}>
                  <LazyModelCharts
                    data={modelData}
                    loading={dataLoading}
                    defaultChartTab={chartPreferences.modelAnalyticsChart}
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </FadeIn>
            </>
          )}
          {activeSection === 'users' && (
            <FadeIn>
              <Suspense fallback={<ModelChartsFallback />}>
                <LazyUserCharts />
              </Suspense>
            </FadeIn>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
