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
import { CreditCard, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  StatusBadge,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
  updateBillingPreference,
} from '@/features/subscriptions/api'
import type {
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { useSubscriptionDisplay } from '../hooks/use-subscription-display'
import { getSubscriptionStatus } from '../lib/subscriptions'
import { SubscriptionList } from './subscription-list'

interface MySubscriptionsCardProps {
  refreshKey?: number
  compact?: boolean
}

function getBillingPreferenceLabel(
  preference: string,
  t: (key: string) => string
): string {
  switch (preference) {
    case 'subscription_first':
      return t('Subscription First')
    case 'wallet_first':
      return t('Wallet First')
    case 'subscription_only':
      return t('Subscription Only')
    case 'wallet_only':
      return t('Wallet Only')
    default:
      return preference
  }
}

function getRemainingDays(sub: UserSubscriptionRecord, now: number) {
  const endTime = sub?.subscription?.end_time || 0
  if (!endTime) return 0
  return Math.max(0, Math.ceil((endTime - now) / 86400))
}

function getUsagePercent(sub: UserSubscriptionRecord) {
  const total = Number(sub?.subscription?.amount_total || 0)
  const used = Number(sub?.subscription?.amount_used || 0)
  if (total <= 0) return 0
  return Math.round((used / total) * 100)
}

export function MySubscriptionsCard({
  refreshKey = 0,
  compact = false,
}: MySubscriptionsCardProps) {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [allSubscriptions, setAllSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const display = useSubscriptionDisplay(allSubscriptions)
  const activeSubscriptions = display.active
  const [billingPreference, setBillingPreference] =
    useState('subscription_first')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchPlans = useCallback(async () => {
    try {
      const res = await getPublicPlans()
      if (res.success) {
        setPlans(res.data || [])
      }
    } catch {
      setPlans([])
    }
  }, [])

  const fetchSelfSubscription = useCallback(async () => {
    try {
      const res = await getSelfSubscriptionFull()
      if (res.success && res.data) {
        setBillingPreference(
          res.data.billing_preference || 'subscription_first'
        )
        setAllSubscriptions(res.data.all_subscriptions || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchPlans(), fetchSelfSubscription()])
      setLoading(false)
    }
    init()
  }, [fetchPlans, fetchSelfSubscription])

  useEffect(() => {
    if (refreshKey > 0) {
      fetchSelfSubscription()
    }
  }, [refreshKey, fetchSelfSubscription])

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of plans) {
      if (p?.plan?.id) {
        map.set(p.plan.id, p.plan.title || '')
      }
    }
    return map
  }, [plans])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchSelfSubscription()
    } finally {
      setRefreshing(false)
    }
  }

  const handlePreferenceChange = async (pref: string) => {
    const previous = billingPreference
    setBillingPreference(pref)
    try {
      const res = await updateBillingPreference(pref)
      if (res.success) {
        toast.success(t('Updated successfully'))
        setBillingPreference(res.data?.billing_preference || pref)
      } else {
        toast.error(res.message || t('Update failed'))
        setBillingPreference(previous)
      }
    } catch {
      toast.error(t('Request failed'))
      setBillingPreference(previous)
    }
  }

  const hasActive = activeSubscriptions.length > 0
  const hasAny = allSubscriptions.length > 0
  const disablePref = !hasActive
  const isSubPref =
    billingPreference === 'subscription_first' ||
    billingPreference === 'subscription_only'
  const displayPref =
    disablePref && isSubPref ? 'wallet_first' : billingPreference

  if (loading) {
    return (
      <TitledCard
        title={t('My Subscriptions')}
        icon={<CreditCard className='h-4 w-4' />}
      >
        <div className='space-y-3'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-20 w-full' />
        </div>
      </TitledCard>
    )
  }

  return (
    <TitledCard
      title={t('My Subscriptions')}
      description={t('Manage your active and historical subscriptions')}
      icon={<CreditCard className='h-4 w-4' />}
      contentClassName='space-y-4'
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <span className='flex flex-wrap items-center gap-1.5 text-xs font-medium'>
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                hasActive ? dotColorMap.success : dotColorMap.neutral
              )}
              aria-hidden='true'
            />
            {hasActive ? (
              <span className={cn(textColorMap.success)}>
                {activeSubscriptions.length} {t('active')}
              </span>
            ) : (
              <span className='text-muted-foreground'>{t('No Active')}</span>
            )}
            {display.pending.length > 0 && (
              <span className='text-muted-foreground'>
                · {display.pending.length} {t('Pending')}
              </span>
            )}
            {display.expired.length > 0 && (
              <span className='text-muted-foreground'>
                · {display.expired.length} {t('expired')}
              </span>
            )}
            {display.cancelled.length > 0 && (
              <span className='text-muted-foreground'>
                · {display.cancelled.length} {t('Cancelled')}
              </span>
            )}
          </span>
        </div>

        <div className='flex w-full items-center gap-2 sm:w-auto'>
          <Select
            items={[
              {
                value: 'subscription_first',
                label: (
                  <>
                    {getBillingPreferenceLabel('subscription_first', t)}
                    {disablePref ? ` (${t('No Active')})` : ''}
                  </>
                ),
              },
              {
                value: 'wallet_first',
                label: getBillingPreferenceLabel('wallet_first', t),
              },
              {
                value: 'subscription_only',
                label: (
                  <>
                    {getBillingPreferenceLabel('subscription_only', t)}
                    {disablePref ? ` (${t('No Active')})` : ''}
                  </>
                ),
              },
              {
                value: 'wallet_only',
                label: getBillingPreferenceLabel('wallet_only', t),
              },
            ]}
            value={displayPref}
            onValueChange={(v) => v !== null && handlePreferenceChange(v)}
          >
            <SelectTrigger className='h-8 flex-1 text-xs sm:w-[160px] sm:flex-none'>
              <SelectValue>
                {getBillingPreferenceLabel(displayPref, t)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='subscription_first' disabled={disablePref}>
                  {getBillingPreferenceLabel('subscription_first', t)}
                  {disablePref ? ` (${t('No Active')})` : ''}
                </SelectItem>
                <SelectItem value='wallet_first'>
                  {getBillingPreferenceLabel('wallet_first', t)}
                </SelectItem>
                <SelectItem value='subscription_only' disabled={disablePref}>
                  {getBillingPreferenceLabel('subscription_only', t)}
                  {disablePref ? ` (${t('No Active')})` : ''}
                </SelectItem>
                <SelectItem value='wallet_only'>
                  {getBillingPreferenceLabel('wallet_only', t)}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8'
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
          </Button>
        </div>
      </div>

      {disablePref && isSubPref && (
        <p className='text-muted-foreground text-xs'>
          {t(
            'Preference saved as {{pref}}, but no active subscription. Wallet will be used automatically.',
            {
              pref:
                billingPreference === 'subscription_only'
                  ? t('Subscription Only')
                  : t('Subscription First'),
            }
          )}
        </p>
      )}

      {hasAny ? (
        <>
          <Separator />
          <SubscriptionList
            current={display.current}
            history={display.history}
            compact={compact}
            renderSubscription={(sub) => {
              const subscription = sub.subscription
              const totalAmount = Number(subscription?.amount_total || 0)
              const usedAmount = Number(subscription?.amount_used || 0)
              const remainAmount =
                totalAmount > 0 ? Math.max(0, totalAmount - usedAmount) : 0
              const planTitle = planTitleMap.get(subscription?.plan_id) || ''
              const remainDays = getRemainingDays(sub, display.now)
              const usagePercent = getUsagePercent(sub)
              const status = getSubscriptionStatus(subscription, display.now)
              const isCancelled = status === 'cancelled'
              const isPending = status === 'pending'
              const isActive = status === 'active'
              let statusLabel = t('Expired')
              let statusVariant: 'success' | 'neutral' = 'neutral'
              if (isActive) {
                statusLabel = t('Active')
                statusVariant = 'success'
              } else if (isPending) {
                statusLabel = t('Pending')
              } else if (isCancelled) {
                statusLabel = t('Cancelled')
              }
              let endLabel = t('Expired at')
              if (isActive || isPending) {
                endLabel = t('Until')
              } else if (isCancelled) {
                endLabel = t('Cancelled at')
              }
              const nextResetTime = subscription?.next_reset_time ?? 0

              return (
                <div
                  key={subscription?.id}
                  className='bg-background rounded-md border p-3 text-xs'
                >
                  <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                      <span className='truncate font-medium'>
                        {planTitle
                          ? `${planTitle} · ${t('Subscription')} #${subscription?.id}`
                          : `${t('Subscription')} #${subscription?.id}`}
                      </span>
                      <StatusBadge
                        label={statusLabel}
                        variant={statusVariant}
                        copyable={false}
                      />
                    </div>
                    {isActive && (
                      <span className='text-muted-foreground shrink-0'>
                        {t('{{count}} days remaining', { count: remainDays })}
                      </span>
                    )}
                  </div>

                  <div className='text-muted-foreground mt-1.5'>
                    {endLabel}{' '}
                    {new Date(
                      (subscription?.end_time || 0) * 1000
                    ).toLocaleString()}
                  </div>
                  {isActive && nextResetTime > 0 && (
                    <div className='text-muted-foreground mt-1'>
                      {t('Next reset')}:{' '}
                      {new Date(nextResetTime * 1000).toLocaleString()}
                    </div>
                  )}
                  <div className='text-muted-foreground mt-1'>
                    {t('Total Quota')}:{' '}
                    {totalAmount > 0 ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={<span className='cursor-help' />}
                        >
                          {formatQuota(usedAmount)}/{formatQuota(totalAmount)} ·{' '}
                          {t('Remaining')} {formatQuota(remainAmount)}
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('Raw Quota')}: {usedAmount}/{totalAmount} ·{' '}
                          {t('Remaining')} {remainAmount}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      t('Unlimited')
                    )}
                    {totalAmount > 0 && (
                      <span className='ml-2'>
                        {t('Used')} {usagePercent}%
                      </span>
                    )}
                  </div>
                  {totalAmount > 0 && isActive && (
                    <Progress value={usagePercent} className='mt-2 h-1.5' />
                  )}
                </div>
              )
            }}
          />
        </>
      ) : (
        <p className='text-muted-foreground text-xs'>
          {t('Subscribe to a plan for model access')}
        </p>
      )}
    </TitledCard>
  )
}
