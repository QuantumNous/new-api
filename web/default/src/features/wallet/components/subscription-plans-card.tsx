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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Crown, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import {
  getPublicPlans,
  getSelfSubscriptionFull,
  cancelSubscriptionRenewal,
  purchaseSubscriptionPlanFlexible,
  quoteSubscriptionPlanFlexible,
  resumeSubscriptionRenewal,
} from '@/features/subscriptions/api'
import { useRecallClaimContext } from '@/features/subscriptions/components/dialogs/subscription-purchase-dialog'
import {
  type FlexiblePaymentChoice,
  type FlexiblePurchaseResponse,
  type PlanRecord,
  type SubscriptionPaymentAvailability,
} from '@/features/subscriptions/types'
import type {
  StripeCheckoutOpenResult,
  StripeCheckoutPresentation,
} from '../hooks/use-payment'
import {
  getRecallPriceDiscount,
  isRecallPriceEligible,
  type RecallPriceDiscount,
} from '../lib/recall-claim'
import {
  type LifecyclePlanRecord,
  type WalletSelfSubscriptionData,
  getFlexiblePlanAction,
  buildFlexibleQuoteRequest,
  buildFlexiblePurchaseRequest,
  getMatchingPaymentQuote,
  mergeFlexibleQuoteProjection,
  normalizeSelfSubscriptionData,
} from '../lib/subscription-plan-lifecycle'
import type { TopupInfo } from '../types'
import { CurrentPlanCard } from './current-plan-card'
import { PlanPurchaseDialog } from './plan-purchase-dialog'

interface SubscriptionPlansCardProps {
  topupInfo: TopupInfo | null
  onAvailabilityChange?: (available: boolean) => void
  userQuota?: number
  onPurchaseSuccess?: () => void | Promise<void>
  onOpenStripeCheckout?: (
    data: FlexiblePurchaseResponse,
    presentation?: StripeCheckoutPresentation
  ) => StripeCheckoutOpenResult
  initialPlans?: LifecyclePlanRecord[]
  initialSelfData?: WalletSelfSubscriptionData
  initialLoading?: boolean
}

const EXTERNAL_RETURN_POLL_KEY = 'new-api:subscription-change-return-pending'
const RENEWAL_FAILURE_TOAST_SHOWN = 'renewal failure toast shown'
const RENEWAL_MUTATION_ALREADY_IN_FLIGHT =
  'renewal mutation already in flight'

const PLAN_DISPLAY_ORDER: Record<string, number> = {
  go: 0,
  pro: 1,
  max: 2,
}

function createStableSubscriptionRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16)
  )
}

function rememberExternalSubscriptionReturn() {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(EXTERNAL_RETURN_POLL_KEY, '1')
}

function getPlanDisplayOrder(title: string): number {
  return PLAN_DISPLAY_ORDER[title.trim().toLowerCase()] ?? 99
}

function formatPlanPrice(amount: number): string {
  return `$${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)}`
}

function getRecallDiscountLabel(
  discount: RecallPriceDiscount,
  percentOff: number,
  t: Translate
): string {
  if (discount.type === 'percent') return `${percentOff}% OFF`
  return t('{{amount}} {{currency}} off', {
    amount: discount.discountAmount.toFixed(2),
    currency: discount.currency,
  }).toUpperCase()
}

type Translate = (key: string, options?: Record<string, unknown>) => string

function getPlanAudience(title: string, t: Translate): string {
  switch (title.trim().toLowerCase()) {
    case 'go':
      return t('For individuals and light everyday use')
    case 'pro':
      return t('For daily development and frequent requests')
    case 'max':
      return t('For teams and high-intensity workloads')
    default:
      return ''
  }
}

function getActionLabel(
  action: ReturnType<typeof getFlexiblePlanAction>,
  t: Translate
): string {
  if (action === 'buy') return t('Buy now')
  if (action === 'repurchase') return t('Repurchase now')
  return t('Switch now')
}

function getPaymentAvailability(
  selfData: WalletSelfSubscriptionData,
  topupInfo: TopupInfo | null
): SubscriptionPaymentAvailability {
  const availability: SubscriptionPaymentAvailability = {
    ...(selfData.payment_availability ?? {}),
  }
  if (!topupInfo?.enable_stripe_topup) {
    availability.stripe_recurring = {
      available: false,
      disabled_reason: 'Stripe is not enabled.',
    }
  }
  return availability
}

function isPaymentChoiceAvailable(
  availability: SubscriptionPaymentAvailability,
  choice: FlexiblePaymentChoice
): boolean {
  return availability[choice]?.available !== false
}

function getPlanEntitlements(plan: PlanRecord['plan'], t: Translate) {
  const monthly = Number(plan.total_amount || 0)
  const window5h = Number(plan.window_5h_amount || 0)
  const window7d = Number(plan.window_week_amount || 0)
  const media = Number(plan.media_credits_monthly || 0)
  return [
    t('Monthly model quota: {{value}}', {
      value: monthly > 0 ? formatQuota(monthly) : t('Unlimited'),
    }),
    t('5-hour limit: {{value}}', {
      value: window5h > 0 ? formatQuota(window5h) : t('Unlimited'),
    }),
    t('7-day limit: {{value}}', {
      value: window7d > 0 ? formatQuota(window7d) : t('Unlimited'),
    }),
    t('Media generation credits: {{value}}', {
      value:
        media > 0
          ? t('{{count}} credits', { count: media })
          : t('Not included'),
    }),
  ]
}

export function SubscriptionPlansCard(props: SubscriptionPlansCardProps) {
  const { t } = useTranslation()
  const {
    topupInfo,
    onAvailabilityChange,
    onPurchaseSuccess,
    onOpenStripeCheckout,
  } = props
  const [plans, setPlans] = useState<LifecyclePlanRecord[]>(
    () => props.initialPlans ?? []
  )
  const [selfData, setSelfData] = useState<WalletSelfSubscriptionData>(
    () => props.initialSelfData ?? normalizeSelfSubscriptionData(undefined)
  )
  const [loading, setLoading] = useState(props.initialLoading ?? true)
  const [refreshing, setRefreshing] = useState(false)
  const [purchaseTarget, setPurchaseTarget] = useState<{
    plan: PlanRecord
    requestId: string
  } | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseProjection, setPurchaseProjection] =
    useState<FlexiblePurchaseResponse | null>(null)
  const quoteRequestSequenceRef = useRef(0)
  const latestQuoteRequestRef = useRef<{
    sequence: number
    paymentChoice: FlexiblePaymentChoice
    months: number
    requestId: string
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [renewalMutationPending, setRenewalMutationPending] = useState(false)
  const renewalMutationInFlightRef = useRef(false)
  const recallClaim = useRecallClaimContext()

  const fetchPlans = useCallback(async () => {
    try {
      const res = await getPublicPlans()
      setPlans(res.success ? ((res.data || []) as LifecyclePlanRecord[]) : [])
    } catch {
      setPlans([])
    }
  }, [])

  const fetchSelfSubscription = useCallback(async () => {
    try {
      const res = await getSelfSubscriptionFull()
      setSelfData(
        normalizeSelfSubscriptionData(res.success ? res.data : undefined)
      )
    } catch {
      setSelfData(normalizeSelfSubscriptionData(undefined))
    }
  }, [])

  useEffect(() => {
    if (props.initialLoading === false) return
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchPlans(), fetchSelfSubscription()])
      setLoading(false)
    }
    void init()
  }, [fetchPlans, fetchSelfSubscription, props.initialLoading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.sessionStorage.getItem(EXTERNAL_RETURN_POLL_KEY)) return
    let cancelled = false
    let attempts = 0
    const poll = async () => {
      if (cancelled || attempts >= 5) return
      attempts += 1
      await fetchSelfSubscription()
      if (attempts >= 5) {
        window.sessionStorage.removeItem(EXTERNAL_RETURN_POLL_KEY)
        return
      }
      window.setTimeout(poll, 2000)
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [fetchSelfSubscription])

  const orderedPlans = useMemo(
    () =>
      [...plans].sort((a, b) => {
        const orderDiff =
          getPlanDisplayOrder(a?.plan?.title || '') -
          getPlanDisplayOrder(b?.plan?.title || '')
        if (orderDiff !== 0) return orderDiff
        return (
          Number(a?.plan?.price_amount || 0) -
          Number(b?.plan?.price_amount || 0)
        )
      }),
    [plans]
  )

  const contract = selfData.contract ?? null
  const currentPlanId =
    contract?.current_plan_id || selfData.current_entitlement?.plan_id || 0
  const currentPlan = orderedPlans.find(
    (item) => item.plan.id === currentPlanId
  )?.plan
  const hasActivePlan = contract?.status === 'active' && !!currentPlan
  const isAvailable = loading || plans.length > 0 || hasActivePlan
  const paymentAvailability = useMemo(
    () => getPaymentAvailability(selfData, topupInfo),
    [selfData, topupInfo]
  )

  useEffect(() => {
    onAvailabilityChange?.(isAvailable)
  }, [isAvailable, onAvailabilityChange])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([fetchPlans(), fetchSelfSubscription()])
    } finally {
      setRefreshing(false)
    }
  }

  const handleCancelRenewal = async () => {
    if (renewalMutationInFlightRef.current) {
      throw new Error(RENEWAL_MUTATION_ALREADY_IN_FLIGHT)
    }
    renewalMutationInFlightRef.current = true
    setRenewalMutationPending(true)
    try {
      const res = await cancelSubscriptionRenewal()
      if (!res.success) {
        toast.error(res.message || t('Payment request failed'))
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      toast.success(t('Subscription renewal canceled'))
      await fetchSelfSubscription()
      await onPurchaseSuccess?.()
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== RENEWAL_FAILURE_TOAST_SHOWN
      ) {
        toast.error(t('Payment request failed'))
      }
      throw error
    } finally {
      renewalMutationInFlightRef.current = false
      setRenewalMutationPending(false)
    }
  }

  const handleResumeRenewal = async () => {
    if (renewalMutationInFlightRef.current) {
      throw new Error(RENEWAL_MUTATION_ALREADY_IN_FLIGHT)
    }
    renewalMutationInFlightRef.current = true
    setRenewalMutationPending(true)
    try {
      const res = await resumeSubscriptionRenewal()
      if (!res.success) {
        toast.error(res.message || t('Payment request failed'))
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      toast.success(t('Subscription renewal resumed'))
      await fetchSelfSubscription()
      await onPurchaseSuccess?.()
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== RENEWAL_FAILURE_TOAST_SHOWN
      ) {
        toast.error(t('Payment request failed'))
      }
      throw error
    } finally {
      renewalMutationInFlightRef.current = false
      setRenewalMutationPending(false)
    }
  }

  const handleConfirmPurchase = async (
    paymentChoice: FlexiblePaymentChoice,
    months: number
  ) => {
    if (!purchaseTarget) return
    if (!isPaymentChoiceAvailable(paymentAvailability, paymentChoice)) {
      toast.error(t('Payment choice is unavailable'))
      return
    }
    setPurchasing(true)
    try {
      const selectedQuote = getMatchingPaymentQuote(
        paymentChoice,
        purchaseProjection?.payment_quotes ?? selfData.payment_quotes,
        months
      )
      const eligibleRecallClaim =
        recallClaim.claim &&
        isRecallPriceEligible(
          recallClaim.view,
          purchaseTarget.plan.plan.id,
          'subscription'
        )
          ? recallClaim.claim
          : undefined
      const res = await purchaseSubscriptionPlanFlexible({
        ...buildFlexiblePurchaseRequest({
          planId: purchaseTarget.plan.plan.id,
          paymentChoice,
          months,
          requestId: purchaseTarget.requestId,
          quoteId: selectedQuote?.quote_id,
          orderId: selectedQuote?.order_id,
          recallClaim: eligibleRecallClaim,
        }),
      })
      if (!res.success || !res.data) {
        toast.error(res.message || t('Payment request failed'))
        return
      }
      setPurchaseProjection(res.data)
      if (
        res.data.status === 'checkout_required' ||
        res.data.status === 'payment_action_required'
      ) {
        rememberExternalSubscriptionReturn()
        setPurchaseTarget(null)
        setPurchaseProjection(null)
        const opened = onOpenStripeCheckout?.(res.data, {
          title: t('Confirm Payment'),
          description: t('Payment is processed securely by Stripe.'),
        })
        if (opened) {
          return
        }
        toast.error(t('Payment request failed'))
        return
      }
      toast.success(t('Updated successfully'))
      setPurchaseTarget(null)
      setPurchaseProjection(null)
      await fetchSelfSubscription()
      await onPurchaseSuccess?.()
    } catch {
      toast.error(t('Payment request failed'))
    } finally {
      setPurchasing(false)
    }
  }

  const handleQuoteRequest = async (
    paymentChoice: FlexiblePaymentChoice,
    months: number
  ) => {
    if (!purchaseTarget) return
    const requestBody = buildFlexibleQuoteRequest({
      planId: purchaseTarget.plan.plan.id,
      paymentChoice,
      months,
      requestId: purchaseTarget.requestId,
      recallClaim:
        recallClaim.claim &&
        isRecallPriceEligible(
          recallClaim.view,
          purchaseTarget.plan.plan.id,
          'subscription'
        )
          ? recallClaim.claim
          : undefined,
    })
    const sequence = quoteRequestSequenceRef.current + 1
    quoteRequestSequenceRef.current = sequence
    const latestRequest = {
      sequence,
      paymentChoice: requestBody.payment_choice,
      months: requestBody.months,
      requestId: requestBody.request_id,
    }
    latestQuoteRequestRef.current = latestRequest
    setQuoteLoading(true)
    try {
      const res = await quoteSubscriptionPlanFlexible(requestBody)
      if (latestQuoteRequestRef.current !== latestRequest) return
      if (res.success && res.data) {
        setPurchaseProjection((current) =>
          mergeFlexibleQuoteProjection(
            current,
            res.data ?? {},
            latestRequest,
            latestQuoteRequestRef.current
          )
        )
      }
    } catch {
      if (latestQuoteRequestRef.current !== latestRequest) return
      setPurchaseProjection((current) => current)
    } finally {
      if (latestQuoteRequestRef.current === latestRequest) {
        setQuoteLoading(false)
      }
    }
  }

  if (loading) {
    return (
      <Card className='gap-0 overflow-hidden py-0'>
        <CardContent className='space-y-4 p-3 sm:p-5'>
          <Skeleton className='h-10 w-48' />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-56 w-full' />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plans.length === 0 && !hasActivePlan) return null

  return (
    <>
      <TitledCard
        title={t('Subscription Plans')}
        description={t(
          'One key, 328+ frontier models: GPT, Claude, Gemini, DeepSeek, GLM for text, plus Seedance 2.5 and more for image & video generation.'
        )}
        icon={<Crown className='h-4 w-4' />}
        iconClassName='bg-[#f0ebfa] text-[#4c1d95] dark:bg-[#5b21b6]/25 dark:text-[#c4b5fd]'
        contentClassName='space-y-4 sm:space-y-5'
        action={
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t('Refresh subscription plans')}
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
            />
          </Button>
        }
      >
        {hasActivePlan && currentPlan ? (
          <CurrentPlanCard
            plan={currentPlan}
            selfData={selfData}
            renewalMutationPending={renewalMutationPending}
            onCancelRenewal={handleCancelRenewal}
            onResumeRenewal={handleResumeRenewal}
          />
        ) : null}

        {plans.length > 0 ? (
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3 xl:gap-4'>
            {orderedPlans.map((item) => {
              const plan = item.plan
              const price = formatPlanPrice(Number(plan.price_amount || 0))
              const recallDiscount = getRecallPriceDiscount(
                recallClaim.view,
                plan.id,
                'subscription',
                Number(plan.price_amount || 0),
                plan.currency || 'USD'
              )
              const isRecommended =
                plan.title.trim().toLowerCase() === 'go' &&
                orderedPlans.length > 1
              const audience =
                getPlanAudience(plan.title, t) || plan.subtitle || ''
              const action = getFlexiblePlanAction({
                planId: plan.id,
                currentPlanId,
                relation: item.relation,
              })
              // A live Stripe recurring subscription renews itself — showing
              // "Repurchase now" on the buyer's own plan reads like the plan is
              // inactive. Label it as the current subscription instead.
              // One-time purchases (Alipay/Pix/balance) keep the repurchase CTA.
              const isCurrentRecurring =
                action === 'repurchase' &&
                selfData.contract?.payment_mode === 'stripe_recurring'
              const entitlements = getPlanEntitlements(plan, t)

              return (
                <Card
                  key={plan.id}
                  className={cn(
                    'ring-border rounded-lg shadow-none transition-shadow',
                    isRecommended
                      ? 'shadow-[0_0_0_6px_rgba(139,92,246,0.1)] ring-2 ring-[#8b5cf6]/60 dark:shadow-[0_0_0_6px_rgba(139,92,246,0.18)]'
                      : 'hover:ring-foreground/20'
                  )}
                >
                  <CardContent className='flex h-full flex-col p-5'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <h4 className='text-xl font-semibold'>
                          {plan.title || t('Subscription Plans')}
                        </h4>
                        {audience ? (
                          <p className='text-muted-foreground mt-0.5 text-xs'>
                            {audience}
                          </p>
                        ) : null}
                      </div>
                      <div className='flex shrink-0 flex-col items-end gap-1'>
                        {recallDiscount ? (
                          <span className='inline-flex rounded-full bg-[#dcfce7] px-2 py-1 text-[11px] font-semibold text-[#166534] uppercase dark:bg-[#14532d]/40 dark:text-[#86efac]'>
                            {getRecallDiscountLabel(
                              recallDiscount,
                              Number(
                                recallClaim.view?.discount.percent_off || 0
                              ),
                              t
                            )}
                          </span>
                        ) : null}
                        {isRecommended ? (
                          <span className='inline-flex items-center gap-1 rounded-full bg-[#f0ebfa] px-2 py-1 text-[11px] font-semibold text-[#4c1d95] dark:bg-[#5b21b6]/25 dark:text-[#c4b5fd]'>
                            <Sparkles className='h-3 w-3' />
                            {t('Recommended')}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className='mt-6 flex items-end gap-2'>
                      <span className='text-5xl font-semibold tracking-tight tabular-nums'>
                        {recallDiscount
                          ? formatPlanPrice(recallDiscount.discountedAmount)
                          : price}
                      </span>
                      {recallDiscount ? (
                        <span className='text-muted-foreground mb-2 text-sm tabular-nums line-through'>
                          {price}
                        </span>
                      ) : null}
                      <span className='text-muted-foreground mb-1 text-sm'>
                        {t('per month')}
                      </span>
                    </div>

                    <div className='mt-5 grow space-y-2 border-t pt-4'>
                      {entitlements.map((label) => (
                        <div
                          key={label}
                          className='text-muted-foreground flex items-center gap-2 text-xs'
                        >
                          <Check className='h-3.5 w-3.5 shrink-0 text-[#5b21b6] dark:text-[#a78bfa]' />
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className='my-4' />
                    <Button
                      className={cn(
                        'min-h-11 w-full',
                        isRecommended &&
                          'bg-[#070707] text-white hover:bg-[#4c1d95] dark:bg-white dark:text-black dark:hover:bg-[#ddd6fe]'
                      )}
                      variant={action === 'switch' ? 'outline' : 'default'}
                      disabled={isCurrentRecurring}
                      onClick={() => {
                        setPurchaseProjection(null)
                        latestQuoteRequestRef.current = null
                        setQuoteLoading(false)
                        setPurchaseTarget({
                          plan: item,
                          requestId: createStableSubscriptionRequestId(),
                        })
                      }}
                    >
                      {isCurrentRecurring
                        ? t('Current subscription')
                        : getActionLabel(action, t)}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('No plans available')}
          </p>
        )}
      </TitledCard>

      <PlanPurchaseDialog
        key={purchaseTarget?.requestId || 'closed'}
        open={!!purchaseTarget}
        onOpenChange={(open) => {
          if (!open && !purchasing) {
            setPurchaseTarget(null)
            setPurchaseProjection(null)
            latestQuoteRequestRef.current = null
            setQuoteLoading(false)
          }
        }}
        plan={purchaseTarget?.plan || null}
        currentPlanId={currentPlanId}
        paymentAvailability={paymentAvailability}
        isLoading={purchasing}
        isQuoteLoading={quoteLoading}
        projectedStart={purchaseProjection?.start_time}
        projectedEnd={purchaseProjection?.end_time}
        projectedRemainingDays={purchaseProjection?.remaining_days}
        paymentQuotes={
          purchaseProjection?.payment_quotes ?? selfData.payment_quotes
        }
        recallDiscount={
          purchaseTarget
            ? getRecallPriceDiscount(
                recallClaim.view,
                purchaseTarget.plan.plan.id,
                'subscription',
                Number(purchaseTarget.plan.plan.price_amount || 0),
                purchaseTarget.plan.plan.currency || 'USD'
              )
            : null
        }
        onConfirm={handleConfirmPurchase}
        onQuoteRequest={handleQuoteRequest}
      />
    </>
  )
}
