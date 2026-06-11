import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionPageLayout } from '@/components/layout'
import { fetchStats, exportStats } from './api'
import {
  type FilterValues,
  UserModelStatsFilters,
} from './components/user-model-stats-filters'
import { UserModelStatsTable } from './components/user-model-stats-table'
import { DEFAULT_PAGE_SIZE, getDefaultDateRange } from './constants'
import { type ViewType, type StatsItem } from './types'

export function UserModelStatsPage() {
  const { t } = useTranslation()
  const { start: defaultStart, end: defaultEnd } = getDefaultDateRange()

  const [activeTab, setActiveTab] = useState<ViewType>('byUser')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<StatsItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [filters, setFilters] = useState<FilterValues>({
    startDate: defaultStart,
    endDate: defaultEnd,
    username: '',
    modelName: '',
    userGroup: '',
  })

  const handleFilterChange = useCallback(
    <K extends keyof FilterValues>(key: K, value: FilterValues[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchStats({
        viewType: activeTab,
        startTimestamp: Math.floor(filters.startDate.getTime() / 1000),
        endTimestamp: Math.floor(filters.endDate.getTime() / 1000),
        username: filters.username || undefined,
        modelName: filters.modelName || undefined,
        userGroup: filters.userGroup || undefined,
        page,
        pageSize,
      })
      if (res.success) {
        setItems(res.data?.items || [])
        setTotal(res.data?.total || 0)
      } else {
        toast.error(res.message || t('Failed to load data'))
      }
    } catch {
      toast.error(t('Failed to load data'))
    } finally {
      setLoading(false)
    }
  }, [activeTab, filters, page, pageSize, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSearch = useCallback(() => {
    setPage(1)
  }, [])

  const handleExport = useCallback(async () => {
    try {
      await exportStats(
        activeTab,
        Math.floor(filters.startDate.getTime() / 1000),
        Math.floor(filters.endDate.getTime() / 1000),
        filters.username || undefined,
        filters.modelName || undefined,
        filters.userGroup || undefined
      )
    } catch {
      toast.error(t('Export failed'))
    }
  }, [activeTab, filters, t])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as ViewType)
    setPage(1)
  }, [])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('User Model Statistics')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <p className='text-muted-foreground mb-4 text-sm'>
          {t('Data from quota_data aggregation table')}
        </p>

        <div className='space-y-4'>
          <UserModelStatsFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onSearch={handleSearch}
            onExport={handleExport}
            loading={loading}
          />

          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value='byUser'>{t('User View')}</TabsTrigger>
              <TabsTrigger value='byModel'>{t('Model View')}</TabsTrigger>
              <TabsTrigger value='byDepartment'>部门视角</TabsTrigger>
              <TabsTrigger value='byDetail'>
                {t('User Model Consumption')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <UserModelStatsTable
            items={items as Record<string, unknown>[]}
            loading={loading}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(ps) => {
              setPageSize(ps)
              setPage(1)
            }}
            type={activeTab}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
