import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RefreshCw } from 'lucide-react'
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
  bind_group: string
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

  // Build mappings
  const groupToPlanMap = new Map<string, PlanInfo>()
  for (const plan of plans) {
    if (plan.upgrade_group) {
      groupToPlanMap.set(plan.upgrade_group, plan)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.post('/api/user/admin/group-sync', { full: true })
      toast.success(t('Group sync completed'))
      await Promise.all([fetchGroups(), fetchPlans()])
    } catch {
      toast.error(t('Group sync failed'))
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3'>
        <p className='text-muted-foreground text-sm'>
          {t('View and manage group-to-plan mapping relationships')}
        </p>
        <Button
          variant='outline'
          size='sm'
          disabled={syncing}
          onClick={handleSync}
        >
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? t('Syncing...') : t('Full Sync')}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='byGroup'>
        <TabsList>
          <TabsTrigger value='byGroup'>{t('By Group')}</TabsTrigger>
          <TabsTrigger value='byPlan'>{t('By Plan')}</TabsTrigger>
        </TabsList>

        {/* By Group View */}
        <TabsContent value='byGroup' className='mt-4'>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Group')}</TableHead>
                  <TableHead>{t('Description')}</TableHead>
                  <TableHead>{t('Bound Plan')}</TableHead>
                  <TableHead>{t('Plan Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className='h-20 text-center text-muted-foreground'>
                      {t('No groups found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group) => {
                    const boundPlan = groupToPlanMap.get(group.name)
                    return (
                      <TableRow key={group.name}>
                        <TableCell className='font-medium'>
                          <Badge variant='outline'>{group.name}</Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {group.desc || '-'}
                        </TableCell>
                        <TableCell>
                          {boundPlan ? (
                            <span className='font-medium'>{boundPlan.title}</span>
                          ) : (
                            <span className='text-muted-foreground'>
                              {t('No plan bound')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {boundPlan ? (
                            <Badge variant={boundPlan.enabled ? 'default' : 'destructive'}>
                              {boundPlan.enabled ? t('Active') : t('Disabled')}
                            </Badge>
                          ) : (
                            <span className='text-muted-foreground'>-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* By Plan View */}
        <TabsContent value='byPlan' className='mt-4'>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Plan')}</TableHead>
                  <TableHead>{t('Upgrade Group')}</TableHead>
                  <TableHead>{t('Bind Group')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className='h-20 text-center text-muted-foreground'>
                      {t('No plans found')}
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className='font-medium'>{plan.title}</TableCell>
                      <TableCell>
                        {plan.upgrade_group ? (
                          <Badge variant='outline'>{plan.upgrade_group}</Badge>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plan.bind_group ? (
                          <Badge variant='outline'>{plan.bind_group}</Badge>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan.enabled ? 'default' : 'destructive'}>
                          {plan.enabled ? t('Active') : t('Disabled')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
