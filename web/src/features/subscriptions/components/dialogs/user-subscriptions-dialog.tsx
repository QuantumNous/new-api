import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  getAdminPlans,
  getUserSubscriptions,
  createUserSubscription,
  invalidateUserSubscription,
  deleteUserSubscription,
} from '../../api'
import { formatTimestamp } from '../../lib'
import type { PlanRecord, UserSubscriptionRecord } from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username?: string } | null
  onSuccess?: () => void
}

function StatusBadge(props: { sub: UserSubscriptionRecord['subscription']; t: any }) {
  const now = Date.now() / 1000
  const isExpired =
    (props.sub.end_time || 0) > 0 && props.sub.end_time < now
  const isActive = props.sub.status === 'active' && !isExpired
  if (isActive) return <Badge variant='success'>{props.t('生效')}</Badge>
  if (props.sub.status === 'cancelled')
    return <Badge variant='secondary'>{props.t('已作废')}</Badge>
  return <Badge variant='secondary'>{props.t('已过期')}</Badge>
}

export function UserSubscriptionsDialog(props: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [subs, setSubs] = useState<UserSubscriptionRecord[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [confirmAction, setConfirmAction] = useState<{
    type: 'invalidate' | 'delete'
    subId: number
  } | null>(null)

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    plans.forEach((p) => {
      if (p.plan.id) map.set(p.plan.id, p.plan.title || `#${p.plan.id}`)
    })
    return map
  }, [plans])

  const loadData = async () => {
    if (!props.user?.id) return
    setLoading(true)
    try {
      const [plansRes, subsRes] = await Promise.all([
        getAdminPlans(),
        getUserSubscriptions(props.user.id),
      ])
      if (plansRes.success) setPlans(plansRes.data || [])
      if (subsRes.success) setSubs(subsRes.data || [])
    } catch {
      toast.error(t('加载失败'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (props.open && props.user?.id) {
      setSelectedPlanId('')
      loadData()
    }
  }, [props.open, props.user?.id])

  const handleCreate = async () => {
    if (!props.user?.id || !selectedPlanId) {
      toast.error(t('请选择订阅套餐'))
      return
    }
    setCreating(true)
    try {
      const res = await createUserSubscription(props.user.id, {
        plan_id: Number(selectedPlanId),
      })
      if (res.success) {
        toast.success(res.data?.message || t('新增成功'))
        setSelectedPlanId('')
        await loadData()
        props.onSuccess?.()
      }
    } catch {
      toast.error(t('请求失败'))
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    try {
      if (confirmAction.type === 'invalidate') {
        const res = await invalidateUserSubscription(confirmAction.subId)
        if (res.success) {
          toast.success(res.data?.message || t('已作废'))
          await loadData()
          props.onSuccess?.()
        }
      } else {
        const res = await deleteUserSubscription(confirmAction.subId)
        if (res.success) {
          toast.success(t('已删除'))
          await loadData()
          props.onSuccess?.()
        }
      }
    } catch {
      toast.error(t('操作失败'))
    } finally {
      setConfirmAction(null)
    }
  }

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className='sm:max-w-2xl overflow-y-auto'>
          <SheetHeader>
            <SheetTitle>{t('用户订阅管理')}</SheetTitle>
            <SheetDescription>
              {props.user?.username || '-'} (ID: {props.user?.id || '-'})
            </SheetDescription>
          </SheetHeader>

          <div className='mt-4 space-y-4'>
            <div className='flex gap-2'>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className='flex-1'>
                  <SelectValue placeholder={t('选择订阅套餐')} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem
                      key={p.plan.id}
                      value={String(p.plan.id)}
                    >
                      {p.plan.title} ($
                      {Number(p.plan.price_amount || 0).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} disabled={creating || !selectedPlanId}>
                <Plus className='mr-1 h-4 w-4' />
                {t('新增订阅')}
              </Button>
            </div>

            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>{t('套餐')}</TableHead>
                    <TableHead>{t('状态')}</TableHead>
                    <TableHead>{t('有效期')}</TableHead>
                    <TableHead>{t('总额度')}</TableHead>
                    <TableHead className='text-right'>{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='text-center py-8'>
                        {t('加载中...')}
                      </TableCell>
                    </TableRow>
                  ) : subs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-center py-8 text-muted-foreground'
                      >
                        {t('暂无订阅记录')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    subs.map((record) => {
                      const sub = record.subscription
                      const now = Date.now() / 1000
                      const isExpired =
                        (sub.end_time || 0) > 0 && sub.end_time < now
                      const isActive =
                        sub.status === 'active' && !isExpired
                      const total = Number(sub.amount_total || 0)
                      const used = Number(sub.amount_used || 0)

                      return (
                        <TableRow key={sub.id}>
                          <TableCell>#{sub.id}</TableCell>
                          <TableCell>
                            <div>
                              <div className='font-medium'>
                                {planTitleMap.get(sub.plan_id) ||
                                  `#${sub.plan_id}`}
                              </div>
                              <div className='text-xs text-muted-foreground'>
                                {t('来源')}: {sub.source || '-'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge sub={sub} t={t} />
                          </TableCell>
                          <TableCell>
                            <div className='text-xs'>
                              <div>
                                {t('开始')}: {formatTimestamp(sub.start_time)}
                              </div>
                              <div>
                                {t('结束')}: {formatTimestamp(sub.end_time)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {total > 0 ? `${used}/${total}` : t('不限')}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex justify-end gap-1'>
                              <Button
                                size='sm'
                                variant='outline'
                                disabled={!isActive}
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'invalidate',
                                    subId: sub.id,
                                  })
                                }
                              >
                                {t('作废')}
                              </Button>
                              <Button
                                size='sm'
                                variant='destructive'
                                onClick={() =>
                                  setConfirmAction({
                                    type: 'delete',
                                    subId: sub.id,
                                  })
                                }
                              >
                                {t('删除')}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setConfirmAction(null)}
          title={
            confirmAction.type === 'invalidate'
              ? t('确认作废')
              : t('确认删除')
          }
          desc={
            confirmAction.type === 'invalidate'
              ? t('作废后该订阅将立即失效，历史记录不受影响。是否继续？')
              : t('删除会彻底移除该订阅记录（含权益明细）。是否继续？')
          }
          handleConfirm={handleConfirmAction}
          destructive={confirmAction.type === 'delete'}
        />
      )}
    </>
  )
}
