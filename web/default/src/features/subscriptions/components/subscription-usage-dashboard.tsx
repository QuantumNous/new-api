import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestamp, formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from 'lucide-react'
import {
  getInactiveUsers,
  getOrgUsage,
  getSubscriptionPlanUsage,
  getAdminPlans,
  getGroups,
  type InactiveUserItem,
  type OrgUsageItem,
  type SubscriptionPlanUsageItem,
} from '../api'
import type { PlanRecord } from '../types'

type UsageTab = 'plan' | 'org' | 'inactive'

export function SubscriptionUsageDashboard() {
  const { t } = useTranslation()

  // Filters
  const [groupFilter, setGroupFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [planIdFilter, setPlanIdFilter] = useState('')
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [days, setDays] = useState(15)

  // Filter options
  const [groupOptions, setGroupOptions] = useState<string[]>([])
  const [planOptions, setPlanOptions] = useState<PlanRecord[]>([])

  // Tab
  const [activeTab, setActiveTab] = useState<UsageTab>('plan')

  // Plan Usage data + pagination
  const [planUsage, setPlanUsage] = useState<SubscriptionPlanUsageItem[]>([])
  const [planTotal, setPlanTotal] = useState(0)
  const [planPage, setPlanPage] = useState(1)
  const [planPageSize, setPlanPageSize] = useState(20)

  // Org Usage data
  const [orgUsage, setOrgUsage] = useState<OrgUsageItem[]>([])

  // Inactive Users data + pagination
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUserItem[]>([])
  const [inactiveTotal, setInactiveTotal] = useState(0)
  const [inactivePage, setInactivePage] = useState(1)
  const [inactivePageSize, setInactivePageSize] = useState(20)

  const [loading, setLoading] = useState(false)

  // Load filter options once
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [groupsRes, plansRes] = await Promise.all([
          getGroups(),
          getAdminPlans(),
        ])
        if (groupsRes.success) {
          setGroupOptions(groupsRes.data || [])
        }
        if (plansRes.success) {
          setPlanOptions(plansRes.data || [])
        }
      } catch {
        // ignore
      }
    }
    loadOptions()
  }, [])

  // Load data
  const loadPlanUsage = useCallback(async () => {
    try {
      const res = await getSubscriptionPlanUsage({
        plan_id: planIdFilter ? Number(planIdFilter) : undefined,
        group: groupFilter || undefined,
        org_name: orgFilter || undefined,
        include_no_plan: true,
        p: planPage,
        page_size: planPageSize,
      })
      if (res.success) {
        setPlanUsage(res.data?.items || [])
        setPlanTotal(res.data?.total || 0)
      }
    } catch {
      // ignore
    }
  }, [groupFilter, orgFilter, planIdFilter, planPage, planPageSize])

  const loadOrgUsage = useCallback(async () => {
    try {
      const res = await getOrgUsage({ days })
      if (res.success) {
        setOrgUsage(res.data || [])
      }
    } catch {
      // ignore
    }
  }, [days])

  const loadInactiveUsers = useCallback(async () => {
    try {
      const res = await getInactiveUsers({
        days,
        p: inactivePage,
        page_size: inactivePageSize,
      })
      if (res.success) {
        setInactiveUsers(res.data?.items || [])
        setInactiveTotal(res.data?.total || 0)
      }
    } catch {
      // ignore
    }
  }, [days, inactivePage, inactivePageSize])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadPlanUsage(), loadOrgUsage(), loadInactiveUsers()])
    } finally {
      setLoading(false)
    }
  }, [loadPlanUsage, loadOrgUsage, loadInactiveUsers])

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter, orgFilter, planIdFilter, planPage, planPageSize, days, inactivePage, inactivePageSize])

  const handleRefresh = () => loadAll()

  // Pagination helpers
  const planTotalPages = Math.max(1, Math.ceil(planTotal / planPageSize))
  const inactiveTotalPages = Math.max(1, Math.ceil(inactiveTotal / inactivePageSize))

  return (
    <div className='space-y-6'>
      {/* Filters */}
      <div className='flex flex-wrap items-end gap-2'>
        <div className='space-y-1'>
          <span className='text-xs text-muted-foreground'>{t('Group')}</span>
          <Select value={groupFilter || '__all__'} onValueChange={(v) => { setGroupFilter(!v || v === '__all__' ? '' : v); setPlanPage(1) }}>
            <SelectTrigger className='h-9 w-44'>
              <SelectValue placeholder={t('All Groups')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>{t('All Groups')}</SelectItem>
              {groupOptions.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <span className='text-xs text-muted-foreground'>{t('Plan')}</span>
          <Select value={planIdFilter || '__all__'} onValueChange={(v) => { setPlanIdFilter(!v || v === '__all__' ? '' : v); setPlanPage(1) }}>
            <SelectTrigger className='h-9 w-52'>
              <SelectValue placeholder={t('All Plans')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='__all__'>{t('All Plans')}</SelectItem>
              {planOptions.map((p) => (
                <SelectItem key={p.plan.id} value={String(p.plan.id)}>
                  {p.plan.title || `Plan #${p.plan.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <span className='text-xs text-muted-foreground'>{t('Month')}</span>
          <Input
            className='h-9 w-36'
            type='month'
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className='space-y-1'>
          <span className='text-xs text-muted-foreground'>{t('Inactive Days')}</span>
          <Input
            className='h-9 w-24'
            type='number'
            value={days}
            onChange={(e) => setDays(Number(e.target.value || 15))}
          />
        </div>

        <Input
          className='h-9 w-48'
          placeholder={t('Filter by org')}
          value={orgFilter}
          onChange={(e) => { setOrgFilter(e.target.value); setPlanPage(1) }}
        />

        <Button size='sm' className='h-9' onClick={handleRefresh} disabled={loading}>
          <RefreshCw className='mr-1 h-3.5 w-3.5' />
          {loading ? t('Loading...') : t('Refresh')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UsageTab)}>
        <TabsList>
          <TabsTrigger value='plan'>{t('Plan Usage')}</TabsTrigger>
          <TabsTrigger value='org'>{t('Org Usage')}</TabsTrigger>
          <TabsTrigger value='inactive'>{t('Inactive Users')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Plan Usage Table */}
      {activeTab === 'plan' && (
        <div className='space-y-3'>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead>{t('Group')}</TableHead>
                  <TableHead>{t('Org')}</TableHead>
                  <TableHead>{t('Plan')}</TableHead>
                  <TableHead>{t('Used / Total')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planUsage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='h-20 text-center text-muted-foreground'>
                      {loading ? t('Loading...') : t('No data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  planUsage.map((row) => (
                    <TableRow key={`${row.user_id}-${row.user_subscription_id || 0}`}>
                      <TableCell>{row.display_name || row.username}</TableCell>
                      <TableCell>{row.user_group || '-'}</TableCell>
                      <TableCell>{row.org_name || '-'}</TableCell>
                      <TableCell>{row.plan_title || t('No plan')}</TableCell>
                      <TableCell>
                        {formatQuota(row.amount_used || 0)} /{' '}
                        {formatQuota(row.amount_total || 0)}
                      </TableCell>
                      <TableCell>{row.status || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {planTotal > 0 && (
            <PaginationControls
              page={planPage}
              pageSize={planPageSize}
              total={planTotal}
              totalPages={planTotalPages}
              onPageChange={setPlanPage}
              onPageSizeChange={(ps) => { setPlanPageSize(ps); setPlanPage(1) }}
              t={t}
            />
          )}
        </div>
      )}

      {/* Org Usage Table */}
      {activeTab === 'org' && (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Org')}</TableHead>
                <TableHead>{t('Total Users')}</TableHead>
                <TableHead>{t('Active Users')}</TableHead>
                <TableHead>{t('Tokens')}</TableHead>
                <TableHead>{t('Quota')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgUsage.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='h-20 text-center text-muted-foreground'>
                    {loading ? t('Loading...') : t('No data')}
                  </TableCell>
                </TableRow>
              ) : (
                orgUsage.map((row) => (
                  <TableRow key={row.org_name || 'none'}>
                    <TableCell>{row.org_name || '-'}</TableCell>
                    <TableCell>{formatNumber(row.total_users)}</TableCell>
                    <TableCell>{formatNumber(row.active_users)}</TableCell>
                    <TableCell>{formatNumber(row.token_used)}</TableCell>
                    <TableCell>{formatQuota(row.quota || 0)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Inactive Users Table */}
      {activeTab === 'inactive' && (
        <div className='space-y-3'>
          <h3 className='text-sm font-semibold'>
            {t('Users Inactive For {{days}} Days', { days })}
          </h3>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead>{t('Group')}</TableHead>
                  <TableHead>{t('Org')}</TableHead>
                  <TableHead>{t('Last Login')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className='h-20 text-center text-muted-foreground'>
                      {loading ? t('Loading...') : t('No data')}
                    </TableCell>
                  </TableRow>
                ) : (
                  inactiveUsers.map((row) => (
                    <TableRow key={row.user_id}>
                      <TableCell>{row.display_name || row.username}</TableCell>
                      <TableCell>{row.user_group || '-'}</TableCell>
                      <TableCell>{row.org_name || '-'}</TableCell>
                      <TableCell>{formatTimestamp(row.last_login_at || 0)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {inactiveTotal > 0 && (
            <PaginationControls
              page={inactivePage}
              pageSize={inactivePageSize}
              total={inactiveTotal}
              totalPages={inactiveTotalPages}
              onPageChange={setInactivePage}
              onPageSizeChange={(ps) => { setInactivePageSize(ps); setInactivePage(1) }}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  )
}

// Reusable pagination controls
function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  t,
}: {
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (p: number) => void
  onPageSizeChange: (ps: number) => void
  t: (key: string, params?: Record<string, unknown>) => string
}) {
  return (
    <div className='flex items-center justify-between'>
      <div className='flex items-center gap-2 text-sm text-muted-foreground'>
        <span>{t('Rows per page')}</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v))}
        >
          <SelectTrigger className='h-8 w-[70px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[20, 50, 100].map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className='ml-2'>
          {t('Page {{current}} of {{total}}', {
            current: page,
            total: totalPages,
          })}
        </span>
        <span className='ml-2'>({total} {t('total')})</span>
      </div>
      <div className='flex items-center gap-1'>
        <Button variant='outline' size='icon' className='h-8 w-8' disabled={page <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className='h-4 w-4' />
        </Button>
        <Button variant='outline' size='icon' className='h-8 w-8' disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <Button variant='outline' size='icon' className='h-8 w-8' disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className='h-4 w-4' />
        </Button>
        <Button variant='outline' size='icon' className='h-8 w-8' disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}
