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
import { Check, Crown, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuota } from '@/lib/format'
import { getGAMeasurementIdentifiers } from '@/lib/analytics/gtag'
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
  type SubscriptionPaymentQuote,
  type SubscriptionRenewalLifecyclePrecondition,
} from '@/features/subscriptions/types'
import type {
  StripeCheckoutOpenResult,
  StripeCheckoutPresentation,
} from '../hooks/use-payment'
import {
  type LifecyclePlanRecord,
  type WalletSelfSubscriptionData,
  applyRenewalLifecycleResultToSelfData,
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
  initialPlanPreviewQuotes?: Record<number, SubscriptionPaymentQuote>
}

const EXTERNAL_RETURN_POLL_KEY = 'new-api:subscription-change-return-pending'
const RENEWAL_FAILURE_TOAST_SHOWN = 'renewal failure toast shown'
const RENEWAL_MUTATION_ALREADY_IN_FLIGHT = 'renewal mutation already in flight'

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

function formatPlanPrice(amount: number, currency = 'USD'): string {
  const normalizedCurrency = currency.trim().toUpperCase() || 'USD'
  let locale = 'en-US'
  if (normalizedCurrency === 'BRL') locale = 'pt-BR'
  if (normalizedCurrency === 'INR') locale = 'en-IN'
  try {
    const currencyFractionDigits = Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
    }).resolvedOptions().maximumFractionDigits
    const fixedTwoDecimals =
      normalizedCurrency === 'BRL' || normalizedCurrency === 'INR'
    let minimumFractionDigits = currencyFractionDigits
    if (fixedTwoDecimals) minimumFractionDigits = 2
    if (!fixedTwoDecimals && Number.isInteger(amount)) {
      minimumFractionDigits = 0
    }
    return Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits,
      maximumFractionDigits: fixedTwoDecimals ? 2 : currencyFractionDigits,
    }).format(amount)
  } catch {
    const formattedAmount = Intl.NumberFormat('en-US', {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)
    return `${normalizedCurrency} ${formattedAmount}`
  }
}

type PlanCardDiscountPreview = {
  currency: string
  discountAmount: number
  discountKind: 'invitation' | 'recall'
  originalTotal: number
  total: number
}

function getPlanCardDiscountPreview(
  quote: SubscriptionPaymentQuote | undefined
): PlanCardDiscountPreview | null {
  if (
    quote?.discount_kind !== 'invitation' &&
    quote?.discount_kind !== 'recall'
  ) {
    return null
  }
  const originalTotal = Number(quote.original_total)
  const total = Number(quote.total)
  const discountAmount = Number(quote.discount_amount ?? originalTotal - total)
  if (
    !Number.isFinite(originalTotal) ||
    !Number.isFinite(total) ||
    !Number.isFinite(discountAmount) ||
    originalTotal <= total ||
    total < 0 ||
    discountAmount <= 0
  ) {
    return null
  }
  const currency =
    typeof quote.currency === 'string' && quote.currency.trim()
      ? quote.currency.trim().toUpperCase()
      : 'USD'
  return {
    currency,
    discountAmount,
    discountKind: quote.discount_kind,
    originalTotal,
    total,
  }
}

type Translate = (key: string, options?: Record<string, unknown>) => string
type SelfSubscriptionRefreshResult = 'applied' | 'superseded' | 'failed'

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

function buildRenewalLifecyclePrecondition(
  selfData: WalletSelfSubscriptionData,
  expectedStatus: SubscriptionRenewalLifecyclePrecondition['expected_renewal_status']
): SubscriptionRenewalLifecyclePrecondition | undefined {
  const contract = selfData.contract
  const source = selfData.renewal_source
  const status = selfData.renewal_status
  if (
    !contract ||
    !Number.isSafeInteger(contract.id) ||
    !Number.isSafeInteger(contract.change_version) ||
    !Number.isSafeInteger(contract.current_period_end) ||
    contract.id <= 0 ||
    contract.change_version < 0 ||
    contract.current_period_end <= 0 ||
    (source !== 'provider_recurring' && source !== 'wallet_auto') ||
    status !== expectedStatus
  ) {
    return undefined
  }
  return {
    expected_contract_id: contract.id,
    expected_change_version: contract.change_version,
    expected_current_period_end: contract.current_period_end,
    expected_renewal_source: source,
    expected_renewal_status: expectedStatus,
  }
}

function getPlanEntitlements(plan: PlanRecord['plan'], t: Translate) {
  const monthly = Number(plan.total_amount || 0)
  const media = Number(plan.media_credits_monthly || 0)
  return [
    t('Monthly model quota: {{value}}', {
      value: monthly > 0 ? formatQuota(monthly) : t('Unlimited'),
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
  const [purchaseTarget, setPurchaseTarget] = useState<{
    plan: PlanRecord
    requestId: string
  } | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseProjection, setPurchaseProjection] =
    useState<FlexiblePurchaseResponse | null>(null)
  const [quoteError, setQuoteError] = useState(false)
  const quoteRequestSequenceRef = useRef(0)
  const latestQuoteRequestRef = useRef<{
    sequence: number
    paymentChoice: FlexiblePaymentChoice
    months: number
    requestId: string
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [planPreviewQuotes, setPlanPreviewQuotes] = useState<
    Record<number, SubscriptionPaymentQuote>
  >(() => props.initialPlanPreviewQuotes ?? {})
  const [renewalMutationPending, setRenewalMutationPending] = useState(false)
  const renewalMutationInFlightRef = useRef(false)
  // A later failed /self refresh must not erase the last successful canonical
  // subscription snapshot; only the initial no-data failure can show empty state.
  const selfSubscriptionRequestSequenceRef = useRef(0)
  const selfSubscriptionAppliedSequenceRef = useRef(0)
  const recallClaim = useRecallClaimContext()

  const fetchPlans = useCallback(async () => {
    try {
      const res = await getPublicPlans()
      setPlans(res.success ? ((res.data || []) as LifecyclePlanRecord[]) : [])
    } catch {
      setPlans([])
    }
  }, [])

  const fetchSelfSubscription = useCallback(
    async (
      options: { preserveOnFailure?: boolean } = {}
    ): Promise<SelfSubscriptionRefreshResult> => {
      const requestSequence = ++selfSubscriptionRequestSequenceRef.current
      try {
        const res = await getSelfSubscriptionFull()
        if (requestSequence < selfSubscriptionAppliedSequenceRef.current) {
          return 'superseded'
        }
        if (
          requestSequence !== selfSubscriptionRequestSequenceRef.current &&
          selfSubscriptionAppliedSequenceRef.current > 0
        ) {
          return 'superseded'
        }
        if (res.success) {
          selfSubscriptionAppliedSequenceRef.current = requestSequence
          setSelfData(normalizeSelfSubscriptionData(res.data))
          return 'applied'
        }
        if (
          !options.preserveOnFailure &&
          selfSubscriptionAppliedSequenceRef.current === 0
        ) {
          setSelfData(normalizeSelfSubscriptionData(undefined))
        }
        return 'failed'
      } catch {
        if (requestSequence < selfSubscriptionAppliedSequenceRef.current) {
          return 'superseded'
        }
        if (requestSequence !== selfSubscriptionRequestSequenceRef.current) {
          return 'superseded'
        }
        if (
          !options.preserveOnFailure &&
          selfSubscriptionAppliedSequenceRef.current === 0
        ) {
          setSelfData(normalizeSelfSubscriptionData(undefined))
        }
        return 'failed'
      }
    },
    []
  )

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
    let cancelled = false
    if (
      loading ||
      orderedPlans.length === 0 ||
      !isPaymentChoiceAvailable(paymentAvailability, 'stripe_recurring')
    ) {
      setPlanPreviewQuotes({})
      return
    }
    setPlanPreviewQuotes({})
    const loadPlanPreviewQuotes = async () => {
      const entries = await Promise.all(
        orderedPlans.map(async (item) => {
          const requestBody = buildFlexibleQuoteRequest({
            planId: item.plan.id,
            paymentChoice: 'stripe_recurring',
            months: 1,
            requestId: createStableSubscriptionRequestId(),
            recallClaim: recallClaim.claim,
          })
          try {
            const res = await quoteSubscriptionPlanFlexible(requestBody)
            const quote = res.success
              ? getMatchingPaymentQuote(
                  'stripe_recurring',
                  res.data?.payment_quotes,
                  1
                )
              : undefined
            return quote ? ([item.plan.id, quote] as const) : null
          } catch {
            return null
          }
        })
      )
      if (cancelled) return
      setPlanPreviewQuotes(
        Object.fromEntries(
          entries.filter(
            (entry): entry is readonly [number, SubscriptionPaymentQuote] =>
              entry !== null
          )
        )
      )
    }
    void loadPlanPreviewQuotes()
    return () => {
      cancelled = true
    }
  }, [loading, orderedPlans, paymentAvailability, recallClaim.claim])

  useEffect(() => {
    onAvailabilityChange?.(isAvailable)
  }, [isAvailable, onAvailabilityChange])

  const refreshAfterRenewal = async () => {
    const selfRefreshResult = await fetchSelfSubscription({
      preserveOnFailure: true,
    })
    if (selfRefreshResult === 'failed') {
      toast.error(t('Subscription updated, but failed to refresh status'))
    }
    try {
      await onPurchaseSuccess?.()
    } catch {
      // onPurchaseSuccess is best-effort and must not affect renewal reconciliation.
    }
  }

  const refreshAfterRenewalFailure = async (
    options: { staleFeedbackOnRefresh?: boolean } = {}
  ) => {
    const selfRefreshResult = await fetchSelfSubscription({
      preserveOnFailure: true,
    })
    if (selfRefreshResult === 'failed') {
      toast.error(t('Failed to refresh subscription status'))
    } else if (options.staleFeedbackOnRefresh) {
      toast.error(
        t('Subscription status changed. Refresh complete; please retry.')
      )
    }
  }

  const handleCancelRenewal = async () => {
    if (renewalMutationInFlightRef.current) {
      throw new Error(RENEWAL_MUTATION_ALREADY_IN_FLIGHT)
    }
    renewalMutationInFlightRef.current = true
    setRenewalMutationPending(true)
    const renewalContractId = selfData.contract?.id ?? null
    let failureRefreshAttempted = false
    try {
      const precondition = buildRenewalLifecyclePrecondition(
        selfData,
        'enabled'
      )
      if (!precondition) {
        await refreshAfterRenewalFailure({ staleFeedbackOnRefresh: true })
        failureRefreshAttempted = true
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      const res = await cancelSubscriptionRenewal(precondition)
      if (!res.success) {
        toast.error(res.message || t('Payment request failed'))
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      const optimisticSequence = ++selfSubscriptionRequestSequenceRef.current
      setSelfData((current) => {
        const next = applyRenewalLifecycleResultToSelfData(
          current,
          res.data,
          renewalContractId
        )
        if (next !== current) {
          selfSubscriptionAppliedSequenceRef.current = optimisticSequence
        }
        return next
      })
      toast.success(t('Subscription renewal canceled'))
      await refreshAfterRenewal()
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== RENEWAL_FAILURE_TOAST_SHOWN
      ) {
        toast.error(t('Payment request failed'))
      }
      if (!failureRefreshAttempted) {
        await refreshAfterRenewalFailure()
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
    const renewalContractId = selfData.contract?.id ?? null
    let failureRefreshAttempted = false
    try {
      const precondition = buildRenewalLifecyclePrecondition(
        selfData,
        'cancelled_by_user'
      )
      if (!precondition) {
        await refreshAfterRenewalFailure({ staleFeedbackOnRefresh: true })
        failureRefreshAttempted = true
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      const res = await resumeSubscriptionRenewal(precondition)
      if (!res.success) {
        toast.error(res.message || t('Payment request failed'))
        throw new Error(RENEWAL_FAILURE_TOAST_SHOWN)
      }
      const optimisticSequence = ++selfSubscriptionRequestSequenceRef.current
      setSelfData((current) => {
        const next = applyRenewalLifecycleResultToSelfData(
          current,
          res.data,
          renewalContractId
        )
        if (next !== current) {
          selfSubscriptionAppliedSequenceRef.current = optimisticSequence
        }
        return next
      })
      toast.success(t('Subscription renewal resumed'))
      await refreshAfterRenewal()
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== RENEWAL_FAILURE_TOAST_SHOWN
      ) {
        toast.error(t('Payment request failed'))
      }
      if (!failureRefreshAttempted) {
        await refreshAfterRenewalFailure()
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
    const selectedQuote = getMatchingPaymentQuote(
      paymentChoice,
      purchaseProjection?.payment_quotes,
      months
    )
    if (!selectedQuote) {
      toast.error(t('Payment quote is unavailable.'))
      return
    }
    setPurchasing(true)
    try {
      const res = await purchaseSubscriptionPlanFlexible({
        ...buildFlexiblePurchaseRequest({
          planId: purchaseTarget.plan.plan.id,
          paymentChoice,
          months,
          requestId: purchaseTarget.requestId,
          quoteId: selectedQuote.quote_id,
          orderId: selectedQuote?.order_id,
          recallClaim: recallClaim.claim,
        }),
        ...getGAMeasurementIdentifiers(),
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

  const requestQuoteForTarget = useCallback(
    async (
      target: {
        plan: PlanRecord
        requestId: string
      },
      paymentChoice: FlexiblePaymentChoice,
      months: number
    ) => {
      const requestBody = buildFlexibleQuoteRequest({
        planId: target.plan.plan.id,
        paymentChoice,
        months,
        requestId: target.requestId,
        recallClaim: recallClaim.claim,
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
      setPurchaseProjection(null)
      setQuoteError(false)
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
        } else {
          setPurchaseProjection(null)
          setQuoteError(true)
        }
      } catch {
        if (latestQuoteRequestRef.current !== latestRequest) return
        setPurchaseProjection(null)
        setQuoteError(true)
      } finally {
        if (latestQuoteRequestRef.current === latestRequest) {
          setQuoteLoading(false)
        }
      }
    },
    [recallClaim.claim]
  )

  const handleQuoteRequest = async (
    paymentChoice: FlexiblePaymentChoice,
    months: number
  ) => {
    if (!purchaseTarget) return
    await requestQuoteForTarget(purchaseTarget, paymentChoice, months)
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
          'One key, 100+ frontier models: GPT, Claude, Gemini, DeepSeek, GLM for text, plus Seedance 2.5 and more for image & video generation.'
        )}
        icon={<Crown className='h-4 w-4' />}
        iconClassName='bg-[#f0ebfa] text-[#4c1d95] dark:bg-[#5b21b6]/25 dark:text-[#c4b5fd]'
        contentClassName='space-y-4 sm:space-y-5'
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
              const discountPreview = getPlanCardDiscountPreview(
                planPreviewQuotes[plan.id]
              )
              const currency =
                discountPreview?.currency || plan.currency || 'USD'
              const originalPrice = formatPlanPrice(
                discountPreview?.originalTotal ??
                  Number(plan.price_amount || 0),
                currency
              )
              const displayPrice = discountPreview
                ? formatPlanPrice(discountPreview.total, currency)
                : originalPrice
              const isMostPopular =
                plan.title.trim().toLowerCase() === 'pro' &&
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
                    isMostPopular
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
                        {discountPreview ? (
                          <span
                            data-discount-kind={discountPreview.discountKind}
                            className='inline-flex rounded-full bg-[#dcfce7] px-2 py-1 text-[11px] font-semibold text-[#166534] uppercase dark:bg-[#14532d]/40 dark:text-[#86efac]'
                          >
                            {t('OFF')}
                          </span>
                        ) : null}
                        {isMostPopular ? (
                          <span className='inline-flex items-center gap-1 rounded-full bg-[#f0ebfa] px-2 py-1 text-[11px] font-semibold text-[#4c1d95] dark:bg-[#5b21b6]/25 dark:text-[#c4b5fd]'>
                            <Sparkles className='h-3 w-3' />
                            {t('Most Popular')}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className='mt-6 flex flex-wrap items-end gap-2'>
                      <span className='text-5xl font-semibold tracking-tight tabular-nums'>
                        {displayPrice}
                      </span>
                      {discountPreview ? (
                        <span className='text-muted-foreground mb-2 text-sm tabular-nums line-through'>
                          {originalPrice}
                        </span>
                      ) : null}
                      <span className='text-muted-foreground mb-1 text-sm'>
                        {t('per month')}
                      </span>
                    </div>
                    {discountPreview ? (
                      <div className='mt-1 text-xs font-medium text-[#166534] dark:text-[#86efac]'>
                        {t('Save {{amount}}', {
                          amount: formatPlanPrice(
                            discountPreview.discountAmount,
                            discountPreview.currency
                          ),
                        })}
                      </div>
                    ) : null}

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
                        isMostPopular &&
                          'bg-[#070707] text-white hover:bg-[#4c1d95] dark:bg-white dark:text-black dark:hover:bg-[#ddd6fe]'
                      )}
                      variant={action === 'switch' ? 'outline' : 'default'}
                      disabled={isCurrentRecurring}
                      onClick={() => {
                        const target = {
                          plan: item,
                          requestId: createStableSubscriptionRequestId(),
                        }
                        setPurchaseProjection(null)
                        latestQuoteRequestRef.current = null
                        setQuoteError(false)
                        setQuoteLoading(false)
                        setPurchaseTarget(target)
                        void requestQuoteForTarget(
                          target,
                          'stripe_recurring',
                          1
                        )
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
            setQuoteError(false)
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
        paymentQuotes={quoteError ? {} : purchaseProjection?.payment_quotes}
        onConfirm={handleConfirmPurchase}
        onQuoteRequest={handleQuoteRequest}
      />
    </>
  )
}
