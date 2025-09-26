import { useState, useCallback } from 'react'
import { RefreshCcw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search as GlobalSearch } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DashboardSearchDialog } from './components/dashboard-search-dialog'
import { ModelMonitoringStats } from './components/model-monitoring-stats'
import { ModelMonitoringTable } from './components/model-monitoring-table'
import { ModelUsageChart } from './components/model-usage-chart'
import { Overview } from './components/overview'
import { StatsCards } from './components/stats-cards'
import { useDashboardData } from './hooks/use-dashboard-data'
import { useModelMonitoring } from './hooks/use-model-monitoring'
import { useUserStats } from './hooks/use-user-stats'

export function Dashboard() {
  const { t } = useTranslation()
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refresh: refreshDashboard,
    fetchData,
    filters,
  } = useDashboardData()

  const { user, isLoading: userLoading } = useUserStats()

  // 模型监控数据
  const {
    data: modelMonitoringData,
    loading: modelMonitoringLoading,
    error: modelMonitoringError,
    refresh: refreshModelMonitoring,
    updateFilters: updateModelMonitoringFilters,
    filters: modelMonitoringFilters,
  } = useModelMonitoring()

  const handleRefresh = useCallback(() => {
    refreshDashboard()
    toast.success(t('dashboard.refresh_success'))
  }, [refreshDashboard, t])

  const handleAdvancedSearch = useCallback(
    (newFilters: any) => {
      fetchData(newFilters)
      toast.success(t('dashboard.search_updated'))
    },
    [fetchData, t]
  )

  const openSearchDialog = useCallback(() => {
    setSearchDialogOpen(true)
  }, [])

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <GlobalSearch />
        <div className='ms-auto flex items-center space-x-4'>
          <LanguageSwitch />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('dashboard.title')}
            </h1>
            <p className='text-muted-foreground'>
              {user
                ? t('dashboard.welcome_back', {
                    name: user.display_name || user.username,
                  })
                : t('dashboard.overview_subtitle')}
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            <Button variant='outline' size='icon' onClick={handleRefresh}>
              <RefreshCcw className='h-4 w-4' />
            </Button>
            <Button variant='outline' onClick={openSearchDialog}>
              <Search className='mr-2 h-4 w-4' />
              {t('dashboard.search_button')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue='overview' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>
              {t('dashboard.overview_tab')}
            </TabsTrigger>
            <TabsTrigger value='models'>{t('dashboard.models')}</TabsTrigger>
          </TabsList>

          <TabsContent value='overview' className='space-y-4'>
            {/* Stats Cards */}
            <StatsCards
              stats={dashboardData.stats}
              userStats={user}
              loading={dashboardLoading || userLoading}
              error={dashboardError}
            />

            {/* Charts Grid */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <div className='col-span-1 lg:col-span-4'>
                <Overview
                  data={dashboardData.trendData}
                  loading={dashboardLoading}
                  error={dashboardError}
                />
              </div>
              <div className='col-span-1 lg:col-span-3'>
                <ModelUsageChart
                  data={dashboardData.modelUsage}
                  loading={dashboardLoading}
                  error={dashboardError}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value='models' className='space-y-4'>
            {/* 模型监控统计卡片 */}
            <ModelMonitoringStats
              stats={modelMonitoringData.stats}
              loading={modelMonitoringLoading}
              error={modelMonitoringError}
            />

            {/* 图表区域 */}
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <div className='col-span-1 lg:col-span-4'>
                <ModelUsageChart
                  data={dashboardData.modelUsage}
                  loading={dashboardLoading}
                  error={dashboardError}
                  title={t('dashboard.model_usage_distribution')}
                  description={t('dashboard.model_usage_description')}
                />
              </div>
              <div className='col-span-1 lg:col-span-3'>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dashboard.top_models_ranking')}</CardTitle>
                    <CardDescription>
                      {t('dashboard.top_models_description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dashboardData.modelUsage.length > 0 ? (
                      <div className='space-y-3'>
                        {dashboardData.modelUsage
                          .slice(0, 10)
                          .map((model, index) => (
                            <div
                              key={model.model}
                              className='flex items-center justify-between rounded-lg border p-3'
                            >
                              <div className='flex items-center space-x-3'>
                                <div className='bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold'>
                                  {index + 1}
                                </div>
                                <div>
                                  <p className='font-medium'>{model.model}</p>
                                  <p className='text-muted-foreground text-sm'>
                                    {t('dashboard.requests_count', {
                                      count: model.count,
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className='text-right'>
                                <p className='font-medium'>
                                  {model.percentage.toFixed(1)}%
                                </p>
                                <p className='text-muted-foreground text-sm'>
                                  ${model.quota.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className='text-muted-foreground flex h-[200px] items-center justify-center'>
                        <p>{t('dashboard.no_model_usage_data')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 详细模型监控表格 */}
            <ModelMonitoringTable
              models={modelMonitoringData.models}
              loading={modelMonitoringLoading}
              error={modelMonitoringError}
              searchTerm={modelMonitoringFilters.searchTerm || ''}
              onSearchChange={(term) =>
                updateModelMonitoringFilters({ searchTerm: term })
              }
              businessGroup={modelMonitoringFilters.businessGroup || 'all'}
              onBusinessGroupChange={(group) =>
                updateModelMonitoringFilters({ businessGroup: group })
              }
              onRefresh={refreshModelMonitoring}
            />
          </TabsContent>
        </Tabs>
      </Main>

      {/* Advanced Search Dialog */}
      <DashboardSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSearch={handleAdvancedSearch}
        currentFilters={filters}
      />
    </>
  )
}
