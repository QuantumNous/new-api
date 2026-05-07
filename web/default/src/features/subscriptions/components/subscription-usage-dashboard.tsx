import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getInactiveUsers,
  getOrgUsage,
  getSubscriptionPlanUsage,
  type InactiveUserItem,
  type OrgUsageItem,
  type SubscriptionPlanUsageItem,
} from '../api'

export function SubscriptionUsageDashboard() {
  const { t } = useTranslation()
  const [group, setGroup] = useState('')
  const [orgName, setOrgName] = useState('')
  const [days, setDays] = useState(15)
  const [planUsage, setPlanUsage] = useState<SubscriptionPlanUsageItem[]>([])
  const [orgUsage, setOrgUsage] = useState<OrgUsageItem[]>([])
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUserItem[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [planRes, orgRes, inactiveRes] = await Promise.all([
        getSubscriptionPlanUsage({
          include_no_plan: true,
          group: group || undefined,
          org_name: orgName || undefined,
          p: 1,
          page_size: 100,
        }),
        getOrgUsage({ days }),
        getInactiveUsers({ days, p: 1, page_size: 200 }),
      ])
      if (planRes.success) {
        setPlanUsage(planRes.data?.items || [])
      }
      if (orgRes.success) {
        setOrgUsage(orgRes.data || [])
      }
      if (inactiveRes.success) {
        setInactiveUsers(inactiveRes.data?.items || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-end gap-2'>
        <Input
          className='w-48'
          placeholder={t('Filter by group')}
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
        <Input
          className='w-56'
          placeholder={t('Filter by org')}
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
        />
        <Input
          className='w-36'
          type='number'
          value={days}
          onChange={(e) => setDays(Number(e.target.value || 15))}
        />
        <Button size='sm' onClick={load} disabled={loading}>
          {loading ? t('Loading...') : t('Refresh')}
        </Button>
      </div>

      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>
          {t('Plan View: User Subscription Usage')}
        </h3>
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
              {planUsage.map((row) => (
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
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className='space-y-2'>
        <h3 className='text-sm font-semibold'>{t('Org Usage')}</h3>
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
              {orgUsage.map((row) => (
                <TableRow key={row.org_name || 'none'}>
                  <TableCell>{row.org_name || '-'}</TableCell>
                  <TableCell>{row.total_users}</TableCell>
                  <TableCell>{row.active_users}</TableCell>
                  <TableCell>{row.token_used}</TableCell>
                  <TableCell>{formatQuota(row.quota || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className='space-y-2'>
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
              {inactiveUsers.map((row) => (
                <TableRow key={row.user_id}>
                  <TableCell>{row.display_name || row.username}</TableCell>
                  <TableCell>{row.user_group || '-'}</TableCell>
                  <TableCell>{row.org_name || '-'}</TableCell>
                  <TableCell>{formatTimestamp(row.last_login_at || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

