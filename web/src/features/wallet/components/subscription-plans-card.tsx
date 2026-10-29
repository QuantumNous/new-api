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
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Crown, RefreshCw, Sparkles, Check } from 'lucide-react'
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableCardGrid, DataTablePagination } from '@/components/data-table'
import { PaginationFrame } from '@/components/pagination-frame'
import {
  StatusBadge,
  dotColorMap,
  textColorMap,
} from '@/components/status-badge'
import { Button } from '@/components/ui/button'
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
import { SubscriptionPurchaseDialog } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import { SubscriptionQuotaSummary } from '@/features/subscriptions/components/subscription-quota-summary'
import { formatDuration, formatResetPeriod } from '@/features/subscriptions/lib'
import type {
  PlanRecord,
  UserSubscriptionRecord,
} from '@/features/subscriptions/types'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import type { PaymentMethod, TopupInfo } from '../types'
import { WalletSubscriptionsList } from './wallet-subscriptions-list'

const planColumns: ColumnDef<PlanRecord>[] = []

interface SubscriptionPlansCardProps {
  topupInfo: TopupInfo | null
  rechargeContent?: ReactNode
  userQuota?: number
  onPurchaseSuccess?: () => void | Promise<void>
}

function getEpayMethods(payMethods: PaymentMethod[] = []): PaymentMethod[] {
  return payMethods.filter(
    (m) => m?.type && m.type !== 'stripe' && m.type !== 'creem'
  )
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

export function SubscriptionPlansCard({
  topupInfo,
  rechargeContent,
  userQuota,
  onPurchaseSuccess,
}: SubscriptionPlansCardProps) {
  const { t } = useTranslation()

  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [activeSubscriptions, setActiveSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const [allSubscriptions, setAllSubscriptions] = useState<
    UserSubscriptionRecord[]
  >([])
  const [billingPreference, setBillingPreference] =
    useState('subscription_first')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null)

  const enableStripe = !!topupInfo?.enable_stripe_topup
  const enableCreem = !!topupInfo?.enable_creem_topup
  const enableWaffoPancake = !!topupInfo?.enable_waffo_pancake_topup
  const enableOnlineTopUp = !!topupInfo?.enable_online_topup
  const epayMethods = useMemo(
    () => getEpayMethods(topupInfo?.pay_methods),
    [topupInfo?.pay_methods]
  )

  const fetchPlans = useCallback(async () => {
    try {
      const res = requireServerSuccess(await getPublicPlans())
      if (res.success) {
        setPlans(res.data || [])
      }
    } catch (error) {
      handleServerError(error)
      setPlans([])
    }
  }, [])

  const fetchSelfSubscription = useCallback(async () => {
    try {
      const res = requireServerSuccess(await getSelfSubscriptionFull())
      if (res.success && res.data) {
        setBillingPreference(
          res.data.billing_preference || 'subscription_first'
        )
        setActiveSubscriptions(res.data.subscriptions || [])
        setAllSubscriptions(res.data.all_subscriptions || [])
      }
    } catch (error) {
      handleServerError(error)
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
        const normalized = res.data?.billing_preference || pref
        setBillingPreference(normalized)
      } else {
        handleServerError(res, t('Update failed'))
        setBillingPreference(previous)
      }
    } catch (error) {
      handleServerError(error, t('Request failed'))
      setBillingPreference(previous)
    }
  }

  const hasActive = activeSubscriptions.length > 0
  const hasAny = allSubscriptions.length > 0
  const isAvailable = loading || plans.length > 0 || hasAny
  const disablePref = !hasActive
  const isSubPref =
    billingPreference === 'subscription_first' ||
    billingPreference === 'subscription_only'

  const planPurchaseCountMap = useMemo(() => {
    const map = new Map<number, number>()
    for (const sub of allSubscriptions) {
      const planId = sub?.subscription?.plan_id
      if (!planId) continue
      map.set(planId, (map.get(planId) || 0) + 1)
    }
    return map
  }, [allSubscriptions])

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of plans) {
      if (p?.plan?.id) {
        map.set(p.plan.id, p.plan.title || '')
      }
    }
    return map
  }, [plans])

  const planTable = useReactTable({
    data: plans,
    columns: planColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.plan.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 3 } },
  })

  return (
    <>
      <div
        data-slot='wallet-overview'
        className={cn(
          'grid min-w-0 items-start gap-4',
          isAvailable && rechargeContent && 'xl:grid-cols-2'
        )}
      >
        {rechargeContent}
        {isAvailable && (
          <section aria-label={t('My Subscriptions')} className='min-w-0'>
            <TitledCard
              title={t('My Subscriptions')}
              description={
                loading ? (
                  <Skeleton className='h-4 w-20' />
                ) : (
                  <span className='flex items-center gap-1.5 text-xs font-medium'>
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
                      <span className='text-muted-foreground'>
                        {t('No Active')}
                      </span>
                    )}
                    {allSubscriptions.length > activeSubscriptions.length && (
                      <>
                        <span className='text-muted-foreground/30'>·</span>
                        <span className='text-muted-foreground'>
                          {allSubscriptions.length - activeSubscriptions.length}{' '}
                          {t('expired')}
                        </span>
                      </>
                    )}
                  </span>
                )
              }
              icon={<Crown className='h-4 w-4' />}
              iconTone='warning'
              action={
                <div className='flex w-full items-center gap-2 sm:w-auto'>
                  <Select
                    disabled={loading}
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
                    value={billingPreference}
                    onValueChange={(v) =>
                      v !== null && handlePreferenceChange(v)
                    }
                  >
                    <SelectTrigger className='h-8 flex-1 text-xs sm:w-[140px] sm:flex-none'>
                      <SelectValue>
                        {getBillingPreferenceLabel(billingPreference, t)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem
                          value='subscription_first'
                          disabled={disablePref}
                        >
                          {getBillingPreferenceLabel('subscription_first', t)}
                          {disablePref ? ` (${t('No Active')})` : ''}
                        </SelectItem>
                        <SelectItem value='wallet_first'>
                          {getBillingPreferenceLabel('wallet_first', t)}
                        </SelectItem>
                        <SelectItem
                          value='subscription_only'
                          disabled={disablePref}
                        >
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
                    aria-label={t('Refresh')}
                    onClick={handleRefresh}
                    disabled={loading || refreshing}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                    />
                  </Button>
                </div>
              }
              disableHoverEffect
            >
              {loading ? (
                <Skeleton className='h-36 w-full' />
              ) : (
                <>
                  {disablePref && isSubPref && (
                    <p className='text-muted-foreground mt-2 text-xs'>
                      {billingPreference === 'subscription_only'
                        ? t(
                            'Preference saved as {{pref}}, but no active subscription. Requests will be rejected.',
                            { pref: t('Subscription Only') }
                          )
                        : t(
                            'Preference saved as {{pref}}, but no active subscription. Wallet will be used automatically.',
                            { pref: t('Subscription First') }
                          )}
                    </p>
                  )}

                  {hasAny && (
                    <WalletSubscriptionsList
                      subscriptions={allSubscriptions}
                      planTitles={planTitleMap}
                    />
                  )}

                  {!hasAny && (
                    <p className='text-muted-foreground mt-2 text-xs'>
                      {t('Subscribe to a plan for model access')}
                    </p>
                  )}
                </>
              )}
            </TitledCard>
          </section>
        )}
      </div>
      {!loading && plans.length > 0 && (
        <TitledCard
          title={t('Subscription Plans')}
          description={t('Subscribe to a plan for model access')}
          icon={<Crown className='h-4 w-4' />}
          iconTone='warning'
          disableHoverEffect
          headerClassName='px-4 py-3 !pb-3 sm:px-5 sm:py-3 sm:!pb-3'
          titleClassName='text-base sm:text-base'
          iconClassName='size-8 sm:size-8'
        >
          <section aria-label={t('Subscription Plans')} className='space-y-3'>
            <PaginationFrame
              resetKey={plans}
              pageIndex={planTable.getState().pagination.pageIndex}
              pagination={
                planTable.getPageCount() > 1 && (
                  <div role='navigation' aria-label={t('Subscription Plans')}>
                    <DataTablePagination table={planTable} compact />
                  </div>
                )
              }
            >
              <DataTableCardGrid
                table={planTable}
                gridClassName='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'
                getRowClassName={(row) =>
                  cn(
                    'h-full p-0',
                    row.original.plan.recommended === true &&
                      'border-primary/70'
                  )
                }
                renderCard={(row) => {
                  const p = row.original
                  const plan = p?.plan
                  if (!plan) return null
                  const totalAmount = Number(plan.total_amount || 0)
                  const price = Number(plan.price_amount || 0).toFixed(2)
                  const isPopular = plan.recommended === true
                  const limit = Number(plan.max_purchase_per_user || 0)
                  const count = planPurchaseCountMap.get(plan.id) || 0
                  const reached = limit > 0 && count >= limit

                  const benefits = [
                    `${t('Validity Period')}: ${formatDuration(plan, t)}`,
                    formatResetPeriod(plan, t) !== t('No Reset')
                      ? `${t('Quota Reset')}: ${formatResetPeriod(plan, t)}`
                      : null,
                    totalAmount > 0
                      ? `${t('Total Quota')}: ${formatQuota(totalAmount)}`
                      : `${t('Total Quota')}: ${t('Unlimited')}`,
                    limit > 0 ? `${t('Purchase Limit')}: ${limit}` : null,
                    plan.upgrade_group
                      ? `${t('Upgrade Group')}: ${plan.upgrade_group}`
                      : null,
                  ].filter(Boolean) as string[]

                  return (
                    <div className='flex h-full min-w-0 flex-col p-4'>
                      <div className='mb-2 flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <h4 className='truncate font-semibold'>
                            {plan.title || t('Subscription Plans')}
                          </h4>
                          {plan.subtitle && (
                            <p className='text-muted-foreground truncate text-xs'>
                              {plan.subtitle}
                            </p>
                          )}
                        </div>
                        {isPopular && (
                          <StatusBadge
                            variant='info'
                            copyable={false}
                            className='shrink-0'
                          >
                            <Sparkles className='h-3 w-3' />
                            {t('Recommended')}
                          </StatusBadge>
                        )}
                      </div>

                      <div className='py-2'>
                        <span className='text-primary text-2xl font-bold'>
                          ${price}
                        </span>
                      </div>

                      <div className='flex-1 space-y-1.5 pb-3'>
                        {benefits.map((label) => (
                          <div
                            key={label}
                            className='text-muted-foreground flex items-center gap-2 text-xs'
                          >
                            <Check className='text-primary h-3 w-3 shrink-0' />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>

                      <div className='pb-3'>
                        <SubscriptionQuotaSummary plan={plan} />
                      </div>

                      <Separator className='mb-3' />

                      {reached ? (
                        <Tooltip>
                          <TooltipTrigger render={<div />}>
                            <Button
                              variant='outline'
                              className='w-full'
                              disabled
                            >
                              {t('Limit Reached')}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('Purchase limit reached')} ({count}/{limit})
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button
                          variant='outline'
                          className='w-full'
                          onClick={() => {
                            setSelectedPlan(p)
                            setPurchaseOpen(true)
                          }}
                        >
                          {t('Subscribe Now')}
                        </Button>
                      )}
                    </div>
                  )
                }}
              />
            </PaginationFrame>
          </section>
        </TitledCard>
      )}

      <SubscriptionPurchaseDialog
        open={purchaseOpen}
        onOpenChange={(open) => {
          setPurchaseOpen(open)
          if (!open) {
            void fetchSelfSubscription()
          }
        }}
        plan={selectedPlan}
        enableStripe={enableStripe}
        enableCreem={enableCreem}
        enableWaffoPancake={enableWaffoPancake}
        enableOnlineTopUp={enableOnlineTopUp}
        epayMethods={epayMethods}
        userQuota={userQuota}
        onPurchaseSuccess={async () => {
          try {
            await onPurchaseSuccess?.()
          } catch (error) {
            handleServerError(error)
          }
        }}
        purchaseLimit={
          selectedPlan?.plan?.max_purchase_per_user
            ? Number(selectedPlan.plan.max_purchase_per_user)
            : undefined
        }
        purchaseCount={
          selectedPlan?.plan?.id
            ? planPurchaseCountMap.get(selectedPlan.plan.id)
            : undefined
        }
      />
    </>
  )
}
