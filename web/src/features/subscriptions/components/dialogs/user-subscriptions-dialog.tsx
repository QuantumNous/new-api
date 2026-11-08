/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Ban, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTableRowActionMenu,
  StaticDataTable,
} from '@/components/data-table'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { getServerMessage } from '@/lib/server-error-message'

import {
  getAdminPlans,
  getUserSubscriptions,
  createUserSubscription,
  invalidateUserSubscription,
  deleteUserSubscription,
  restoreUserSubscriptionQuota,
} from '../../api'
import { formatTimestamp } from '../../lib'
import type { PlanRecord, UserSubscriptionRecord } from '../../types'
import { SubscriptionQuotaSummary } from '../subscription-quota-summary'
import { SubscriptionResetSchedule } from '../subscription-reset-schedule'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username?: string } | null
  onSuccess?: () => void
}

function SubscriptionStatusBadge(props: {
  sub: UserSubscriptionRecord['subscription']
  t: (key: string) => string
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now() / 1000
  const isExpired = (props.sub.end_time || 0) > 0 && props.sub.end_time < now
  const isActive = props.sub.status === 'active' && !isExpired
  if (isActive) {
    return (
      <StatusBadge
        label={props.t('Active')}
        variant='success'
        copyable={false}
      />
    )
  }
  if (props.sub.status === 'cancelled') {
    return (
      <StatusBadge
        label={props.t('Invalidated')}
        variant='neutral'
        copyable={false}
      />
    )
  }
  return (
    <StatusBadge
      label={props.t('Expired')}
      variant='neutral'
      copyable={false}
    />
  )
}

export function UserSubscriptionsDialog(props: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [subs, setSubs] = useState<UserSubscriptionRecord[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [restoringQuota, setRestoringQuota] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'invalidate' | 'delete'
    subId: number
  } | null>(null)
  const [quotaRestoreAction, setQuotaRestoreAction] = useState<{
    subId: number
    action: 'restore_window' | 'initialize'
    idempotencyKey: string
    reason: string
    submitted?: boolean
    unlimited: boolean
  } | null>(null)

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    plans.forEach((p) => {
      if (p.plan.id) map.set(p.plan.id, p.plan.title || `#${p.plan.id}`)
    })
    return map
  }, [plans])

  const loadData = useCallback(async () => {
    if (!props.user?.id) return
    setLoading(true)
    try {
      const [plansRes, subsRes] = await Promise.all([
        getAdminPlans(),
        getUserSubscriptions(props.user.id),
      ])
      if (plansRes.success) {
        setPlans(plansRes.data || [])
      } else {
        handleServerError(plansRes)
      }
      if (subsRes.success) {
        setSubs(subsRes.data || [])
      } else {
        handleServerError(subsRes)
      }
    } catch (error) {
      handleServerError(error, t('Loading failed'))
    } finally {
      setLoading(false)
    }
  }, [props.user?.id, t])

  useEffect(() => {
    if (props.open && props.user?.id) {
      setSelectedPlanId('')
      loadData()
    }
  }, [props.open, props.user?.id, loadData])

  const handleCreate = async () => {
    if (!props.user?.id || !selectedPlanId) {
      toast.error(t('Please select a subscription plan'))
      return
    }
    setCreating(true)
    try {
      const res = await createUserSubscription(props.user.id, {
        plan_id: Number(selectedPlanId),
      })
      if (res.success) {
        toast.success(getServerMessage(res.data) || t('Added successfully'))
        setSelectedPlanId('')
        await loadData()
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Request failed'))
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
          toast.success(getServerMessage(res.data) || t('Has been invalidated'))
          await loadData()
          props.onSuccess?.()
        } else {
          handleServerError(res)
        }
      } else {
        const res = await deleteUserSubscription(confirmAction.subId)
        if (res.success) {
          toast.success(t('Deleted'))
          await loadData()
          props.onSuccess?.()
        } else {
          handleServerError(res)
        }
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setConfirmAction(null)
    }
  }

  const handleQuotaRestore = async () => {
    if (!props.user?.id || !quotaRestoreAction || restoringQuota) return
    const reason = quotaRestoreAction.reason.trim()
    if (!reason) return
    setQuotaRestoreAction({ ...quotaRestoreAction, reason, submitted: true })
    setRestoringQuota(true)
    try {
      const res = await restoreUserSubscriptionQuota(
        props.user.id,
        quotaRestoreAction.subId,
        {
          action: quotaRestoreAction.action,
          idempotency_key: quotaRestoreAction.idempotencyKey,
          reason,
        }
      )
      if (res.success && res.data) {
        if (res.data.unlimited) {
          toast.success(t('Quota is unlimited; restoration did not add quota.'))
        } else {
          toast.success(
            t(
              'Restored {{returned}} quota. Total remaining: {{total}}; window remaining: {{window}}.',
              {
                returned: formatQuota(res.data.returned_quota),
                total: formatQuota(res.data.total_remaining),
                window: formatQuota(res.data.window_remaining),
              }
            )
          )
        }
        setQuotaRestoreAction(null)
        await loadData()
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setRestoringQuota(false)
    }
  }

  const newIdempotencyKey = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className={sideDrawerContentClassName('sm:max-w-2xl')}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('User Subscription Management')}</SheetTitle>
            <SheetDescription>
              {props.user?.username || '-'} (ID: {props.user?.id || '-'})
            </SheetDescription>
          </SheetHeader>

          <div className={sideDrawerFormClassName()}>
            <div className='flex gap-2'>
              <Combobox
                options={plans.map((p) => ({
                  value: String(p.plan.id),
                  label: `${p.plan.title} ($${Number(p.plan.price_amount || 0).toFixed(2)})`,
                }))}
                value={selectedPlanId}
                onValueChange={(v) => v !== null && setSelectedPlanId(v)}
                className='flex-1'
                placeholder={t('Select subscription plan')}
              />
              <Button
                onClick={handleCreate}
                disabled={creating || !selectedPlanId}
              >
                <Plus className='mr-1 h-4 w-4' />
                {t('Add subscription')}
              </Button>
            </div>

            <StaticDataTable
              data={loading ? [] : subs}
              getRowKey={(record) => record.subscription.id}
              emptyClassName={loading ? 'py-8' : 'text-muted-foreground py-8'}
              emptyContent={
                loading ? t('Loading...') : t('No subscription records')
              }
              columns={[
                {
                  id: 'id',
                  header: t('ID'),
                  cell: (record) => <TableId value={record.subscription.id} />,
                },
                {
                  id: 'plan',
                  header: t('Plan'),
                  cell: (record) => {
                    const sub = record.subscription

                    return (
                      <div>
                        <div className='font-medium'>
                          {sub.plan_title ||
                            planTitleMap.get(sub.plan_id) ||
                            `#${sub.plan_id}`}
                          {sub.plan_version
                            ? ` · ${t('Version')} ${sub.plan_version}`
                            : ''}
                        </div>
                        <div className='text-muted-foreground text-sm'>
                          {t('Source')}: {sub.source || '-'}
                        </div>
                      </div>
                    )
                  },
                },
                {
                  id: 'status',
                  header: t('Status'),
                  cell: (record) => (
                    <SubscriptionStatusBadge sub={record.subscription} t={t} />
                  ),
                },
                {
                  id: 'validity',
                  header: t('Validity'),
                  cell: (record) => {
                    const sub = record.subscription

                    return (
                      <div className='text-sm'>
                        <div>
                          {t('Start')}: {formatTimestamp(sub.start_time)}
                        </div>
                        <div>
                          {t('End')}: {formatTimestamp(sub.end_time)}
                        </div>
                        <SubscriptionResetSchedule
                          lastResetTime={sub.last_reset_time}
                          nextResetTime={sub.next_reset_time}
                          resetPolicySource={sub.reset_policy_source}
                          legacyResetBaselineAt={sub.legacy_reset_baseline_at}
                          className='text-sm'
                        />
                      </div>
                    )
                  },
                },
                {
                  id: 'quota',
                  header: t('Total Quota'),
                  cell: (record) => {
                    const sub = record.subscription
                    return <SubscriptionQuotaSummary subscription={sub} />
                  },
                },
                {
                  id: 'actions',
                  header: t('Actions'),
                  className: 'text-right',
                  cellClassName: 'text-right',
                  cell: (record) => {
                    const sub = record.subscription
                    const now = Date.now() / 1000
                    const isExpired =
                      (sub.end_time || 0) > 0 && sub.end_time < now
                    const isActive = sub.status === 'active' && !isExpired

                    return (
                      <DataTableRowActionMenu ariaLabel={t('Actions')}>
                        <DropdownMenuItem
                          disabled={!isActive}
                          onClick={() =>
                            setQuotaRestoreAction({
                              subId: sub.id,
                              action: 'restore_window',
                              idempotencyKey: newIdempotencyKey(),
                              reason: '',
                              unlimited: Number(sub.amount_total || 0) === 0,
                            })
                          }
                        >
                          {t('Restore window quota')}
                          <DropdownMenuShortcut>
                            <RotateCcw size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isActive}
                          onClick={() =>
                            setQuotaRestoreAction({
                              subId: sub.id,
                              action: 'initialize',
                              idempotencyKey: newIdempotencyKey(),
                              reason: '',
                              unlimited: Number(sub.amount_total || 0) === 0,
                            })
                          }
                        >
                          {t('Initialize subscription quota')}
                          <DropdownMenuShortcut>
                            <RotateCcw size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isActive}
                          onClick={() =>
                            setConfirmAction({
                              type: 'invalidate',
                              subId: sub.id,
                            })
                          }
                        >
                          {t('Invalidate')}
                          <DropdownMenuShortcut>
                            <Ban size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant='destructive'
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete',
                              subId: sub.id,
                            })
                          }
                        >
                          {t('Delete')}
                          <DropdownMenuShortcut>
                            <Trash2 size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </DataTableRowActionMenu>
                    )
                  },
                },
              ]}
            />
          </div>
        </SheetContent>
      </Sheet>

      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setConfirmAction(null)}
          title={
            confirmAction.type === 'invalidate'
              ? t('Confirm invalidate')
              : t('Confirm delete')
          }
          desc={
            confirmAction.type === 'invalidate'
              ? t(
                  'After invalidating, this subscription will be immediately deactivated. Historical records are not affected. Continue?'
                )
              : t(
                  'Deleting will permanently remove this subscription record (including benefit details). Continue?'
                )
          }
          handleConfirm={handleConfirmAction}
          destructive={confirmAction.type === 'delete'}
        />
      )}

      {quotaRestoreAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setQuotaRestoreAction(null)}
          title={
            quotaRestoreAction.action === 'restore_window'
              ? t('Restore window quota')
              : t('Initialize subscription quota')
          }
          desc={
            quotaRestoreAction.action === 'restore_window'
              ? t(
                  'Restore up to one window quota and clear current window usage. Total quota, history, in-flight requests, and subscription dates stay unchanged.'
                )
              : t(
                  'Clear settled total and window usage while preserving historical consumption, in-flight requests, and subscription dates.'
                )
          }
          confirmText={
            quotaRestoreAction.action === 'restore_window'
              ? t('Restore window')
              : t('Initialize traffic')
          }
          handleConfirm={handleQuotaRestore}
          disabled={!quotaRestoreAction.reason.trim()}
          isLoading={restoringQuota}
        >
          <label className='grid gap-2 text-sm'>
            <span>{t('Reason')}</span>
            <Textarea
              value={quotaRestoreAction.reason}
              onChange={(event) =>
                setQuotaRestoreAction((current) =>
                  current && !current.submitted
                    ? { ...current, reason: event.target.value }
                    : current
                )
              }
              readOnly={quotaRestoreAction.submitted}
              placeholder={t('Enter reason for this operation')}
              maxLength={2000}
              rows={3}
              aria-label={t('Reason')}
            />
          </label>
          {quotaRestoreAction.unlimited && (
            <p className='text-muted-foreground text-sm'>
              {t('Quota is unlimited; restoration did not add quota.')}
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
