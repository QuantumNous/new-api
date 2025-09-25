import { useState, useCallback } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, DownloadIcon, RefreshCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
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
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    to: new Date(),
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refresh: refreshDashboard,
    fetchData,
    filters,
    isAdmin,
  } = useDashboardData()

  const { user } = useUserStats()

  // 模型监控数据
  const {
    data: modelMonitoringData,
    loading: modelMonitoringLoading,
    error: modelMonitoringError,
    refresh: refreshModelMonitoring,
    updateFilters: updateModelMonitoringFilters,
    filters: modelMonitoringFilters,
  } = useModelMonitoring()

  const handleDateRangeChange = useCallback(
    (range: { from: Date; to: Date }) => {
      setDateRange(range)
      setIsCalendarOpen(false)
      // TODO: Update dashboard data with new date range
      toast.success('Date range updated')
    },
    []
  )

  const handleRefresh = useCallback(() => {
    refreshDashboard()
    toast.success('Dashboard refreshed')
  }, [refreshDashboard])

  const handleExport = useCallback(() => {
    // TODO: Implement data export functionality
    toast.success('Export started')
  }, [])

  const handleAdvancedSearch = useCallback(
    (newFilters: any) => {
      fetchData(newFilters)
      toast.success('Search updated')
    },
    [fetchData]
  )

  const openSearchDialog = useCallback(() => {
    setSearchDialogOpen(true)
  }, [])

  const formatDateRange = () => {
    if (!dateRange.from || !dateRange.to) return 'Select date range'
    if (dateRange.from.toDateString() === dateRange.to.toDateString()) {
      return format(dateRange.from, 'MMM dd, yyyy')
    }
    return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <GlobalSearch />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <p className='text-muted-foreground'>
              {user
                ? `Welcome back, ${user.display_name || user.username}`
                : 'Overview of your API usage'}
            </p>
          </div>
          <div className='flex items-center space-x-2'>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant='outline'
                  className={cn(
                    'w-[280px] justify-start text-left font-normal',
                    !dateRange.from && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className='mr-2 h-4 w-4' />
                  {formatDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='end'>
                <Calendar
                  mode='range'
                  defaultMonth={dateRange.from}
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      handleDateRangeChange({ from: range.from, to: range.to })
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button variant='outline' size='icon' onClick={handleRefresh}>
              <RefreshCcw className='h-4 w-4' />
            </Button>
            <Button variant='outline' onClick={openSearchDialog}>
              <Search className='mr-2 h-4 w-4' />
              Advanced Search
            </Button>
            <Button onClick={handleExport}>
              <DownloadIcon className='mr-2 h-4 w-4' />
              Export
            </Button>
          </div>
        </div>

        <Tabs defaultValue='overview' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics'>Analytics</TabsTrigger>
            <TabsTrigger value='models'>Models</TabsTrigger>
            <TabsTrigger value='monitoring'>模型观测</TabsTrigger>
            {isAdmin && <TabsTrigger value='admin'>Admin</TabsTrigger>}
          </TabsList>

          <TabsContent value='overview' className='space-y-4'>
            {/* Stats Cards */}
            <StatsCards
              stats={dashboardData.stats}
              loading={dashboardLoading}
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

          <TabsContent value='analytics' className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Detailed usage analytics and insights
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='text-muted-foreground flex h-[400px] items-center justify-center'>
                  <div className='text-center'>
                    <p className='text-lg font-medium'>Coming Soon</p>
                    <p className='mt-2 text-sm'>
                      Advanced analytics features are in development
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='models' className='space-y-4'>
            <div className='grid grid-cols-1 gap-4'>
              <ModelUsageChart
                data={dashboardData.modelUsage}
                loading={dashboardLoading}
                error={dashboardError}
                title='Detailed Model Usage'
                description='Comprehensive breakdown of usage by model'
              />

              {/* Model Usage Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Model Usage Details</CardTitle>
                  <CardDescription>
                    Detailed statistics for each model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dashboardData.modelUsage.length > 0 ? (
                    <div className='space-y-2'>
                      {dashboardData.modelUsage.slice(0, 10).map((model) => (
                        <div
                          key={model.model}
                          className='flex items-center justify-between rounded-lg border p-3'
                        >
                          <div>
                            <p className='font-medium'>{model.model}</p>
                            <p className='text-muted-foreground text-sm'>
                              {model.count} requests
                            </p>
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
                      <p>No model usage data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value='monitoring' className='space-y-4'>
            {/* 模型监控统计 */}
            <ModelMonitoringStats
              stats={modelMonitoringData.stats}
              loading={modelMonitoringLoading}
              error={modelMonitoringError}
            />

            {/* 模型监控表格 */}
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

          {isAdmin && (
            <TabsContent value='admin' className='space-y-4'>
              <Card>
                <CardHeader>
                  <CardTitle>Admin Dashboard</CardTitle>
                  <CardDescription>
                    System-wide statistics and management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='text-muted-foreground flex h-[400px] items-center justify-center'>
                    <div className='text-center'>
                      <p className='text-lg font-medium'>Admin Features</p>
                      <p className='mt-2 text-sm'>
                        Advanced admin features are in development
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
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
