import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppHeader, Main } from '@/components/layout'
import { LogStatCards } from './components/models/log-stat-cards'
import { ModelCharts } from './components/models/model-charts'
import { ModelsFilter } from './components/models/models-filter-dialog'
import { AnnouncementsPanel } from './components/overview/announcements-panel'
import { ApiInfoPanel } from './components/overview/api-info-panel'
import { FAQPanel } from './components/overview/faq-panel'
import { SummaryCards } from './components/overview/summary-cards'
import { UptimePanel } from './components/overview/uptime-panel'
import { type DashboardFilters } from './types'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [modelFilters, setModelFilters] = useState<DashboardFilters>({})
  const [modelData, setModelData] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  const handleFilterChange = useCallback((filters: DashboardFilters) => {
    setModelFilters(filters)
  }, [])

  const handleResetFilters = useCallback(() => {
    setModelFilters({})
  }, [])

  const handleDataUpdate = useCallback((data: any[], loading: boolean) => {
    setModelData(data)
    setDataLoading(loading)
  }, [])

  return (
    <>
      {/* ===== Top Heading ===== */}
      <AppHeader fixed />

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <div className='flex items-center space-x-2'>
            {activeTab === 'models' && (
              <ModelsFilter
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
              />
            )}
          </div>
        </div>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-4'
        >
          <div className='w-full overflow-x-auto pb-2'>
            <TabsList>
              <TabsTrigger value='overview'>Overview</TabsTrigger>
              <TabsTrigger value='models'>Models</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value='overview' className='space-y-4'>
            <SummaryCards />
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <ApiInfoPanel />
              <AnnouncementsPanel />
              <FAQPanel />
              <UptimePanel />
            </div>
          </TabsContent>
          <TabsContent value='models' className='space-y-4'>
            <LogStatCards
              filters={modelFilters}
              onDataUpdate={handleDataUpdate}
            />
            <div className='grid grid-cols-1 gap-4'>
              <ModelCharts
                data={modelData}
                loading={dataLoading}
                timeGranularity={modelFilters.time_granularity || 'day'}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
