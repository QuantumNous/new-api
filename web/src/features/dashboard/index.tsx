import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AnnouncementsPanel } from './components/announcements-panel'
import { ApiInfoPanel } from './components/api-info-panel'
import { FAQPanel } from './components/faq-panel'
import { LogStatCards, type LogStatFilters } from './components/log-stat-cards'
import {
  ModelsFilter,
  type ModelFilterValues,
} from './components/models-filter'
import { SummaryCards } from './components/summary-cards'
import { UptimePanel } from './components/uptime-panel'
import { UsageChart, type UsageChartFilters } from './components/usage-chart'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [modelFilters, setModelFilters] = useState<LogStatFilters>({})

  const handleFilterChange = (filters: ModelFilterValues) => {
    setModelFilters(filters as LogStatFilters)
  }

  const handleResetFilters = () => {
    setModelFilters({})
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} />
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

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
            </div>
          </TabsContent>
          <TabsContent value='models' className='space-y-4'>
            <LogStatCards filters={modelFilters} />
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
              <UsageChart filters={modelFilters as UsageChartFilters} />
              <UptimePanel />
            </div>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Customers',
    href: 'dashboard/customers',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Products',
    href: 'dashboard/products',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Settings',
    href: 'dashboard/settings',
    isActive: false,
    disabled: true,
  },
]
