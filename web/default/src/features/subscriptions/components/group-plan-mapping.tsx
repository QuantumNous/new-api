import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type GroupInfo = {
  name: string
  ratio: unknown
  desc: string
}

type PlanInfo = {
  id: number
  title: string
  upgrade_group: string
  enabled: boolean
}

export function GroupPlanMapping() {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    Promise.all([fetchGroups(), fetchPlans()]).finally(() => setLoading(false))
  }, [])

  const fetchGroups = async () => {
    try {
      const res = await api.get('/api/user/groups')
      if (res.data?.success) {
        const groupMap = res.data.data as Record<string, GroupInfo>
        setGroups(
          Object.entries(groupMap).map(([name, info]) => ({
            name,
            ratio: info.ratio,
            desc: info.desc || '',
          }))
        )
      }
    } catch {
      toast.error(t('Failed to load groups'))
    }
  }

  const fetchPlans = async () => {
    try {
      const res = await api.get('/api/subscription/admin/plans')
      if (res.data?.success) {
        const planRecords = res.data.data as { plan: PlanInfo }[]
        setPlans(planRecords.map((r) => r.plan))
      }
    } catch {
      toast.error(t('Failed to load plans'))
    }
  }

  const getPlanForGroup = (groupName: string): PlanInfo | undefined => {
    return plans.find((p) => p.upgrade_group === groupName)
  }

  const getGroupForPlan = (plan: PlanInfo): string => {
    return plan.upgrade_group || '-'
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.post('/api/user/admin/group-sync', { full: true })
      toast.success(t('Group sync completed'))
    } catch {
      toast.error(t('Group sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t('View and manage group-to-plan mapping relationships')}
        </p>
        <Button
          variant='outline'
          size='sm'
          disabled={syncing}
          onClick={handleSync}
        >
          {syncing ? t('Syncing...') : t('Full Sync')}
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Bound Plan')}</TableHead>
              <TableHead>{t('Plan Status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const boundPlan = getPlanForGroup(group.name)
              return (
                <TableRow key={group.name}>
                  <TableCell className='font-medium'>{group.name}</TableCell>
                  <TableCell>
                    {boundPlan ? boundPlan.title : (
                      <span className='text-muted-foreground'>
                        {t('No plan bound')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {boundPlan ? (
                      <span className={boundPlan.enabled ? 'text-green-600' : 'text-red-500'}>
                        {boundPlan.enabled ? t('Active') : t('Disabled')}
                      </span>
                    ) : (
                      <span className='text-muted-foreground'>-</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {groups.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className='text-center text-muted-foreground'>
                  {t('No groups found')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='space-y-2'>
        <h3 className='text-sm font-medium'>{t('Plans Overview')}</h3>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Plan')}</TableHead>
                <TableHead>{t('Target Group')}</TableHead>
                <TableHead>{t('Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className='font-medium'>{plan.title}</TableCell>
                  <TableCell>{getGroupForPlan(plan)}</TableCell>
                  <TableCell>
                    <span className={plan.enabled ? 'text-green-600' : 'text-red-500'}>
                      {plan.enabled ? t('Active') : t('Disabled')}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {plans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className='text-center text-muted-foreground'>
                    {t('No plans found')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
