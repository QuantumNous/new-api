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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  sideDrawerContentClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { getAdminPlans, getUserSubscriptions } from '../../api'
import { formatTimestamp } from '../../lib'
import type {
  AdminUserSubscriptionsResponse,
  PlanRecord,
  SubscriptionEntitlement,
  SubscriptionPendingChangeDTO,
  UserSubscriptionRecord,
} from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: { id: number; username?: string } | null
  onSuccess?: () => void
}

function formatCurrentEntitlementLabel(
  entitlement: SubscriptionEntitlement | null | undefined,
  planTitleMap: Map<number, string>
) {
  if (!entitlement) return ''
  const planId = entitlement.plan_id
  const title = planTitleMap.get(planId) || `#${planId}`
  return `${title} / #${entitlement.entitlement_id}`
}

function formatPendingIntentLabel(
  intent: SubscriptionPendingChangeDTO | null | undefined
) {
  if (!intent) return ''
  const parts = [
    intent.kind,
    intent.status,
    intent.to_plan_id ? `#${intent.to_plan_id}` : undefined,
  ].filter(Boolean)
  return parts.join(' / ') || `#${intent.intent_id}`
}

function formatMigrationConflictLabel(
  migration: AdminUserSubscriptionsResponse['migration'] | undefined,
  t: (key: string) => string
) {
  if (!migration?.requires_admin_review) return '-'
  return migration.reason || migration.classification || t('Detected')
}

function SubscriptionStatusBadge(props: {
  sub: UserSubscriptionRecord['subscription']
  t: (key: string) => string
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now() / 1000
  const isExpired = (props.sub.end_time || 0) > 0 && props.sub.end_time < now
  const isActive = props.sub.status === 'active' && !isExpired
  if (isActive)
    return (
      <StatusBadge
        label={props.t('Active')}
        variant='success'
        copyable={false}
      />
    )
  if (props.sub.status === 'cancelled')
    return (
      <StatusBadge
        label={props.t('Invalidated')}
        variant='neutral'
        copyable={false}
      />
    )
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
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [adminLifecycle, setAdminLifecycle] =
    useState<AdminUserSubscriptionsResponse | null>(null)
  const userId = props.user?.id

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    plans.forEach((p) => {
      if (p.plan.id) map.set(p.plan.id, p.plan.title || `#${p.plan.id}`)
    })
    return map
  }, [plans])

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [plansRes, subsRes] = await Promise.all([
        getAdminPlans(),
        getUserSubscriptions(userId),
      ])
      if (plansRes.success) setPlans(plansRes.data || [])
      if (subsRes.success) setAdminLifecycle(subsRes.data || null)
    } catch {
      toast.error(t('Loading failed'))
    } finally {
      setLoading(false)
    }
  }, [userId, t])

  useEffect(() => {
    if (props.open && userId) {
      queueMicrotask(() => {
        void loadData()
      })
    }
  }, [props.open, userId, loadData])

  const history = adminLifecycle?.history || []
  const currentEntitlement = adminLifecycle?.current_entitlement
  const currentBinding = adminLifecycle?.current_binding
  const pendingChange = adminLifecycle?.pending_change
  const currentPeriodStart = adminLifecycle?.current_period.start || 0
  const currentPeriodEnd = adminLifecycle?.current_period.end || 0
  const gracePeriodEnd = adminLifecycle?.current_period.grace_period_end || 0
  const quotaAmountTotal = adminLifecycle?.quota.amount_total
  const quotaAmountUsed = adminLifecycle?.quota.amount_used
  const quotaAmountRemaining = adminLifecycle?.quota.amount_remaining
  const quotaUnlimited = adminLifecycle?.quota.unlimited
  let quotaUnlimitedLabel = '-'
  if (quotaUnlimited !== undefined) {
    quotaUnlimitedLabel = quotaUnlimited ? t('Yes') : t('No')
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
            <div className='grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2'>
              <div>
                <div className='text-muted-foreground'>
                  {t('Current Entitlement')}
                </div>
                <div className='font-medium'>
                  {currentEntitlement
                    ? formatCurrentEntitlementLabel(
                        currentEntitlement,
                        planTitleMap
                      )
                    : t('No current entitlement')}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>
                  {t('Binding State')}
                </div>
                <div className='font-medium'>
                  {currentBinding
                    ? `${currentBinding.provider}: ${currentBinding.provider_status || '-'}`
                    : '-'}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>
                  {t('Pending Intent')}
                </div>
                <div className='font-medium'>
                  {pendingChange
                    ? formatPendingIntentLabel(pendingChange)
                    : t('No pending intent')}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Start')}</div>
                <div className='font-medium'>
                  {currentPeriodStart > 0
                    ? formatTimestamp(currentPeriodStart)
                    : '-'}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('End')}</div>
                <div className='font-medium'>
                  {currentPeriodEnd > 0
                    ? formatTimestamp(currentPeriodEnd)
                    : '-'}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Grace Period')}</div>
                <div className='font-medium'>
                  {gracePeriodEnd > 0 ? formatTimestamp(gracePeriodEnd) : '-'}
                </div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Total Quota')}</div>
                <div className='font-medium'>{quotaAmountTotal ?? '-'}</div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Used')}</div>
                <div className='font-medium'>{quotaAmountUsed ?? '-'}</div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Remaining')}</div>
                <div className='font-medium'>{quotaAmountRemaining ?? '-'}</div>
              </div>
              <div>
                <div className='text-muted-foreground'>{t('Unlimited')}</div>
                <div className='font-medium'>{quotaUnlimitedLabel}</div>
              </div>
              <div className='sm:col-span-2'>
                <div className='text-muted-foreground'>
                  {t('Migration Conflict')}
                </div>
                <div className='font-medium'>
                  {formatMigrationConflictLabel(adminLifecycle?.migration, t)}
                </div>
              </div>
            </div>

            <div className='text-muted-foreground text-sm font-medium'>
              {t('Read-only History')}
            </div>

            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>{t('Plan')}</TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Provider')}</TableHead>
                    <TableHead>{t('Validity')}</TableHead>
                    <TableHead>{t('Total Quota')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className='py-8 text-center'>
                        {t('Loading...')}
                      </TableCell>
                    </TableRow>
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-muted-foreground py-8 text-center'
                      >
                        {t('No subscription records')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((record) => {
                      const sub = record.subscription
                      const total = Number(sub.amount_total || 0)
                      const used = Number(sub.amount_used || 0)
                      const binding = record.provider_binding
                      const isStripeRecurring = binding?.provider === 'stripe'

                      return (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <TableId value={sub.id} />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className='font-medium'>
                                {planTitleMap.get(sub.plan_id) ||
                                  `#${sub.plan_id}`}
                              </div>
                              <div className='text-muted-foreground text-sm'>
                                {t('Source')}: {sub.source || '-'}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <SubscriptionStatusBadge sub={sub} t={t} />
                          </TableCell>
                          <TableCell>
                            {binding ? (
                              <div className='space-y-1 text-sm'>
                                <StatusBadge
                                  label={
                                    isStripeRecurring
                                      ? t('Stripe recurring')
                                      : binding.provider
                                  }
                                  variant='info'
                                  copyable={false}
                                />
                                <div className='text-muted-foreground'>
                                  {binding.provider_status || '-'}
                                  {binding.cancel_at_period_end
                                    ? ` / ${t('Cancels at period end')}`
                                    : ''}
                                </div>
                              </div>
                            ) : (
                              <span className='text-muted-foreground'>-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              <div>
                                {t('Start')}: {formatTimestamp(sub.start_time)}
                              </div>
                              <div>
                                {t('End')}: {formatTimestamp(sub.end_time)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {total > 0 ? `${used}/${total}` : t('Unlimited')}
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
    </>
  )
}
