import { useState, useCallback, lazy, Suspense } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AppHeader, Main } from '@/components/layout'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { AnnouncementsPanel } from './components/overview/announcements-panel'
import { ApiInfoPanel } from './components/overview/api-info-panel'
import { FAQPanel } from './components/overview/faq-panel'
import { SummaryCards } from './components/overview/summary-cards'
import { UptimePanel } from './components/overview/uptime-panel'
import { DEFAULT_TIME_GRANULARITY } from './constants'
import {
  type DashboardFilters,
  type QuotaDataItem,
} from './types'
import type { DashboardSectionId } from './section-registry'
import { DASHBOARD_DEFAULT_SECTION } from './section-registry'

const route = getRouteApi('/_authenticated/dashboard/')

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

function LogStatCardsFallback() {
  return (
    <Card>
      <CardContent>
        <Skeleton className='h-32 w-full' />
      </CardContent>
    </Card>
  )
}

function ModelChartsFallback() {
  return (
    <Card className='!rounded-2xl !py-0'>
      <div className='flex w-full flex-col gap-3 px-6 pt-6 lg:flex-row lg:items-center lg:justify-between'>
        <Skeleton className='h-5 w-36' />
        <Skeleton className='h-9 w-80' />
      </div>
      <CardContent className='px-0 pt-0'>
        <div className='h-96 p-2'>
          <Skeleton className='h-full w-full' />
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const activeSection = (search.section ?? DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [modelFilters, setModelFilters] = useState<DashboardFilters>({})
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters({})
  }, [])

  const handleDataUpdate = useCallback((data: QuotaDataItem[], loading: boolean) => {
    setModelData(data)
    setDataLoading(loading)
  }, [])

  return (
    <>
      {/* ===== Top Heading ===== */}
      <AppHeader fixed />

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {activeSection === 'overview' ? t('Overview') : t('Models')}
            </h2>
            <p className='text-muted-foreground'>
              {activeSection === 'overview'
                ? t('View dashboard overview and statistics')
                : t('View model statistics and charts')}
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            {activeSection === 'models' && (
              <ModelsFilter
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
              />
            )}
          </div>
        </div>
        <div className='space-y-4'>
          {activeSection === 'overview' ? (
            <>
              <SummaryCards />
              <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <ApiInfoPanel />
                <AnnouncementsPanel />
                <FAQPanel />
                <UptimePanel />
              </div>
            </>
          ) : (
            <>
              <Suspense fallback={<LogStatCardsFallback />}>
                <LazyLogStatCards
                  filters={modelFilters}
                  onDataUpdate={handleDataUpdate}
                />
              </Suspense>
              <div className='grid grid-cols-1 gap-4'>
                <Suspense fallback={<ModelChartsFallback />}>
                  <LazyModelCharts
                    data={modelData}
                    loading={dataLoading}
                    timeGranularity={
                      modelFilters.time_granularity || DEFAULT_TIME_GRANULARITY
                    }
                  />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </Main>
    </>
  )
}
