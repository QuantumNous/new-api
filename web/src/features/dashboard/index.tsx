import { useState, useCallback, lazy, Suspense } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionPageLayout } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { AnnouncementsPanel } from './components/overview/announcements-panel'
import { ApiInfoPanel } from './components/overview/api-info-panel'
import { FAQPanel } from './components/overview/faq-panel'
import { SummaryCards } from './components/overview/summary-cards'
import { UptimePanel } from './components/overview/uptime-panel'
import { DEFAULT_TIME_GRANULARITY } from './constants'
import {
  type DashboardSectionId,
  DASHBOARD_DEFAULT_SECTION,
} from './section-registry'
import { type DashboardFilters, type QuotaDataItem } from './types'

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
  const params = route.useParams()
  const activeSection = (params.section ??
    DASHBOARD_DEFAULT_SECTION) as DashboardSectionId

  const [modelFilters, setModelFilters] = useState<DashboardFilters>({})
  const [modelData, setModelData] = useState<QuotaDataItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters({})
  }, [])

  const handleDataUpdate = useCallback(
    (data: QuotaDataItem[], loading: boolean) => {
      setModelData(data)
      setDataLoading(loading)
    },
    []
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {activeSection === 'overview' ? t('Overview') : t('Models')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {activeSection === 'overview'
          ? t('View dashboard overview and statistics')
          : t('View model statistics and charts')}
      </SectionPageLayout.Description>
      {activeSection === 'models' && (
        <SectionPageLayout.Actions>
          <ModelsFilter
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        </SectionPageLayout.Actions>
      )}
      <SectionPageLayout.Content>
        <div className='space-y-4'>
          {activeSection === 'overview' ? (
            <>
              <SummaryCards />
              <CardStaggerContainer className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                <CardStaggerItem>
                  <ApiInfoPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <AnnouncementsPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <FAQPanel />
                </CardStaggerItem>
                <CardStaggerItem>
                  <UptimePanel />
                </CardStaggerItem>
              </CardStaggerContainer>
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
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
