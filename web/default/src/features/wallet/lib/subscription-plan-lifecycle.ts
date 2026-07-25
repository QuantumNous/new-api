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
import type {
  ChangePlanPaymentMode,
  PlanRecord,
  SelfSubscriptionData,
  SelfSubscriptionDataResponse,
  FlexiblePaymentChoice,
  FlexiblePurchaseRequest,
  FlexiblePurchaseResponse,
  SubscriptionPaymentAvailability,
  SubscriptionPaymentQuote,
  SubscriptionPaymentQuotes,
  SubscriptionUsageWindow,
  SubscriptionContract,
  SubscriptionCurrentPeriod,
  SubscriptionQuota,
} from '@/features/subscriptions/types'
import type { TopupInfo } from '../types'

export type PlanAction =
  | 'current'
  | 'upgrade_now'
  | 'downgrade_next_period'
  | 'unavailable'

export type FlexiblePlanAction = 'buy' | 'repurchase' | 'switch'

type PlanRelation = 'current' | 'upgrade' | 'downgrade' | 'unavailable'

type LegacyCapabilityAliases = {
  migration_required?: boolean
  migration_blocked_reason?: string
}

type WalletSubscriptionCapabilities = {
  can_change_plan: boolean
  can_use_stripe_recurring: boolean
  can_use_balance_one_period: boolean
  can_cancel: boolean
  can_resume: boolean
  requires_support: boolean
  has_pending_intent: boolean
  is_grace: boolean
  is_cancel_at_period_end: boolean
  has_migration_conflict: boolean
} & LegacyCapabilityAliases

type WalletSubscriptionMigration = {
  requires_admin_review: boolean
  classification: string
  reason: string
}

type WalletPlanLifecycle = Pick<
  WalletSelfSubscriptionData,
  'capabilities' | 'contract' | 'migration'
>

export type LifecyclePlanRecord = PlanRecord & {
  relation?: PlanRelation | string
  tier_rank?: number | null
}

export type WalletSubscriptionContract = SubscriptionContract & {
  id: number
  current_period_start?: number
  current_period_end?: number
  grace_period_end?: number
}

export type FlexibleQuoteRequest = Omit<
  FlexiblePurchaseRequest,
  'quote_id' | 'order_id'
>

export type FlexibleQuoteSnapshotRequest = {
  sequence: number
  paymentChoice: FlexiblePaymentChoice
  months: number
  requestId: string
}

export type WalletSelfSubscriptionData = Omit<
  SelfSubscriptionData,
  'capabilities' | 'contract' | 'current_period' | 'migration' | 'quota'
> & {
  contract?: WalletSubscriptionContract | null
  current_period?: SubscriptionCurrentPeriod
  quota?: SubscriptionQuota
  monthly_bucket?: SubscriptionQuota
  window_5h?: SubscriptionUsageWindow
  window_7d?: SubscriptionUsageWindow
  media_credits?: SubscriptionUsageWindow
  remaining_days?: number
  renewal_source?: string
  renewal_status?: string
  payment_availability?: SubscriptionPaymentAvailability
  payment_quotes?: SubscriptionPaymentQuotes
  capabilities: WalletSubscriptionCapabilities
  migration: WalletSubscriptionMigration
}

const DEFAULT_CAPABILITIES: WalletSelfSubscriptionData['capabilities'] = {
  can_change_plan: false,
  can_use_stripe_recurring: false,
  can_use_balance_one_period: false,
  can_cancel: false,
  can_resume: false,
  requires_support: true,
  has_pending_intent: false,
  is_grace: false,
  is_cancel_at_period_end: false,
  has_migration_conflict: true,
}

const DEFAULT_CURRENT_PERIOD: SubscriptionCurrentPeriod = {
  start: 0,
  end: 0,
  grace_period_end: 0,
}

const DEFAULT_QUOTA: SubscriptionQuota = {
  amount_total: 0,
  amount_used: 0,
  amount_remaining: 0,
  unlimited: true,
}

const EMPTY_USAGE_WINDOW: SubscriptionUsageWindow = {
  used: 0,
  total: 0,
  remaining: 0,
  reset_at: 0,
  unlimited: true,
}

const EMPTY_MEDIA_USAGE_WINDOW: SubscriptionUsageWindow = {
  used: 0,
  total: 0,
  remaining: 0,
  reset_at: 0,
  unlimited: false,
}

const DEFAULT_MIGRATION: WalletSelfSubscriptionData['migration'] = {
  requires_admin_review: true,
  classification: 'unknown',
  reason: '',
}

function normalizeMigration(
  data: SelfSubscriptionDataResponse | undefined
): WalletSelfSubscriptionData['migration'] {
  const migration = data?.migration
  const requiresReview =
    typeof migration?.requires_admin_review === 'boolean'
      ? migration.requires_admin_review
      : true

  return {
    requires_admin_review: requiresReview,
    classification:
      migration?.classification ?? DEFAULT_MIGRATION.classification,
    reason: migration?.reason ?? DEFAULT_MIGRATION.reason,
  }
}

function normalizeContract(
  contract: SelfSubscriptionDataResponse['contract'],
  currentPeriod: SubscriptionCurrentPeriod | undefined
): WalletSubscriptionContract | null | undefined {
  if (!contract) return contract
  const canonicalContract = contract as SubscriptionContract & {
    id?: number
    current_period_start?: number
    current_period_end?: number
    grace_period_end?: number
  }
  return {
    ...canonicalContract,
    id: canonicalContract.id ?? canonicalContract.contract_id ?? 0,
    current_period_start:
      canonicalContract.current_period_start ?? currentPeriod?.start ?? 0,
    current_period_end:
      canonicalContract.current_period_end ?? currentPeriod?.end ?? 0,
    grace_period_end:
      canonicalContract.grace_period_end ??
      currentPeriod?.grace_period_end ??
      0,
  }
}

function normalizeMediaUsageWindow(
  window: SubscriptionUsageWindow | undefined
): SubscriptionUsageWindow {
  const normalized = window ?? EMPTY_MEDIA_USAGE_WINDOW
  if (Number(normalized.total ?? 0) > 0) return normalized
  return {
    ...normalized,
    unlimited: false,
  }
}

export function normalizeSelfSubscriptionData(
  data: SelfSubscriptionDataResponse | undefined
): WalletSelfSubscriptionData {
  const migration = normalizeMigration(data)
  const capabilities = data?.capabilities
  const hasMigrationConflict =
    typeof capabilities?.has_migration_conflict === 'boolean'
      ? capabilities.has_migration_conflict
      : DEFAULT_CAPABILITIES.has_migration_conflict

  return {
    billing_preference: data?.billing_preference || 'subscription_first',
    contract: normalizeContract(data?.contract, data?.current_period) ?? null,
    current_entitlement: data?.current_entitlement ?? null,
    current_period: data?.current_period ?? DEFAULT_CURRENT_PERIOD,
    quota: data?.quota ?? DEFAULT_QUOTA,
    monthly_bucket: data?.monthly_bucket ?? data?.quota ?? DEFAULT_QUOTA,
    window_5h: data?.window_5h ?? EMPTY_USAGE_WINDOW,
    window_7d: data?.window_7d ?? EMPTY_USAGE_WINDOW,
    media_credits: normalizeMediaUsageWindow(data?.media_credits),
    remaining_days: data?.remaining_days,
    renewal_source: data?.renewal_source,
    renewal_status: data?.renewal_status,
    payment_availability: data?.payment_availability ?? {},
    payment_quotes: data?.payment_quotes ?? {},
    pending_change: data?.pending_change ?? null,
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      can_change_plan: capabilities?.can_change_plan === true,
      can_use_stripe_recurring: capabilities?.can_use_stripe_recurring === true,
      can_use_balance_one_period:
        capabilities?.can_use_balance_one_period === true,
      can_cancel: capabilities?.can_cancel === true,
      can_resume: capabilities?.can_resume === true,
      requires_support:
        capabilities?.requires_support ?? DEFAULT_CAPABILITIES.requires_support,
      has_pending_intent: capabilities?.has_pending_intent === true,
      is_grace: capabilities?.is_grace === true,
      is_cancel_at_period_end: capabilities?.is_cancel_at_period_end === true,
      has_migration_conflict: hasMigrationConflict,
    },
    migration,
    subscriptions: data?.subscriptions || [],
    all_subscriptions: data?.all_subscriptions || [],
    recurring_subscriptions: data?.recurring_subscriptions || [],
  }
}

export function getFlexiblePlanAction(args: {
  planId: number
  currentPlanId: number
  relation?: string
}): FlexiblePlanAction {
  if (!args.currentPlanId) return 'buy'
  if (args.planId === args.currentPlanId) return 'repurchase'
  return 'switch'
}

export function buildFlexiblePurchaseRequest(args: {
  planId: number
  paymentChoice: FlexiblePaymentChoice
  months: number
  requestId: string
  quoteId?: string
  orderId?: string
}): FlexiblePurchaseRequest {
  return {
    plan_id: args.planId,
    payment_choice: args.paymentChoice,
    months:
      args.paymentChoice === 'stripe_recurring'
        ? 1
        : Math.min(12, Math.max(1, Math.round(args.months))),
    request_id: args.requestId,
    ...(args.quoteId ? { quote_id: args.quoteId } : {}),
    ...(args.orderId ? { order_id: args.orderId } : {}),
    ...(args.paymentChoice !== 'balance'
      ? { ui_mode: 'embedded' as const }
      : {}),
  }
}

function normalizeFlexibleMonths(
  paymentChoice: FlexiblePaymentChoice,
  months: number
): number {
  if (paymentChoice === 'stripe_recurring') return 1
  return Math.min(12, Math.max(1, Math.round(months)))
}

export function buildFlexibleQuoteRequest(args: {
  planId: number
  paymentChoice: FlexiblePaymentChoice
  months: number
  requestId: string
}): FlexibleQuoteRequest {
  return {
    plan_id: args.planId,
    payment_choice: args.paymentChoice,
    months: normalizeFlexibleMonths(args.paymentChoice, args.months),
    request_id: args.requestId,
  }
}

export function requiresLocalCurrencyQuote(
  paymentChoice: FlexiblePaymentChoice
): boolean {
  return paymentChoice === 'pix' || paymentChoice === 'upi'
}

export function requiresSignedCheckoutQuote(
  paymentChoice: FlexiblePaymentChoice
): boolean {
  return paymentChoice === 'alipay' || requiresLocalCurrencyQuote(paymentChoice)
}

export function getMatchingPaymentQuote(
  paymentChoice: FlexiblePaymentChoice,
  quotes: SubscriptionPaymentQuotes | undefined,
  months: number,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): SubscriptionPaymentQuote | undefined {
  const quote = quotes?.[paymentChoice]
  if (!quote) return undefined
  if (!requiresSignedCheckoutQuote(paymentChoice)) return quote

  if (quote.months !== normalizeFlexibleMonths(paymentChoice, months)) {
    return undefined
  }
  if (typeof quote.quote_id !== 'string' || quote.quote_id.trim().length === 0) {
    return undefined
  }
  if (
    typeof quote.expires_at !== 'number' ||
    !Number.isFinite(quote.expires_at) ||
    quote.expires_at <= nowUnixSeconds
  ) {
    return undefined
  }

  if (requiresLocalCurrencyQuote(paymentChoice)) {
    const expectedCurrency = paymentChoice === 'pix' ? 'BRL' : 'INR'
    if (quote.currency !== expectedCurrency) return undefined
  }

  return quote
}

function normalizeQuoteForRequest(
  quote: SubscriptionPaymentQuote | undefined,
  request: FlexibleQuoteSnapshotRequest
): SubscriptionPaymentQuote | undefined {
  if (!quote) return undefined
  if (typeof quote.months === 'number' && quote.months !== request.months) {
    return undefined
  }
  return { ...quote, months: request.months }
}

export function mergeFlexibleQuoteProjection(
  current: FlexiblePurchaseResponse | null,
  response: Pick<
    FlexiblePurchaseResponse,
    'payment_quotes' | 'start_time' | 'end_time' | 'remaining_days'
  >,
  responseRequest: FlexibleQuoteSnapshotRequest,
  latestRequest: FlexibleQuoteSnapshotRequest | null
): FlexiblePurchaseResponse | null {
  if (
    !latestRequest ||
    responseRequest.sequence !== latestRequest.sequence ||
    responseRequest.paymentChoice !== latestRequest.paymentChoice ||
    responseRequest.months !== latestRequest.months ||
    responseRequest.requestId !== latestRequest.requestId
  ) {
    return current
  }

  const selectedQuote = normalizeQuoteForRequest(
    response.payment_quotes?.[responseRequest.paymentChoice],
    responseRequest
  )
  const nextQuotes: SubscriptionPaymentQuotes = {
    ...(current?.payment_quotes ?? {}),
    ...(response.payment_quotes ?? {}),
  }
  if (selectedQuote) {
    nextQuotes[responseRequest.paymentChoice] = selectedQuote
  } else {
    delete nextQuotes[responseRequest.paymentChoice]
  }

  return {
    ...(current ?? { status: 'applied' }),
    payment_quotes: nextQuotes,
    start_time: response.start_time ?? current?.start_time,
    end_time: response.end_time ?? current?.end_time,
    remaining_days: response.remaining_days ?? current?.remaining_days,
  }
}

export function getDisplayedPlanAction(
  planRecord: LifecyclePlanRecord,
  currentPlanId: number,
  allowedPaymentModes: ChangePlanPaymentMode[],
  lifecycle: WalletSelfSubscriptionData['capabilities'] | WalletPlanLifecycle
): PlanAction {
  if (planRecord.relation === 'current' || planRecord.plan.id === currentPlanId)
    return 'current'
  const hasLifecycle = 'capabilities' in lifecycle
  const capabilities = hasLifecycle ? lifecycle.capabilities : lifecycle
  const migrationRequiresAdminReview = hasLifecycle
    ? lifecycle.migration.requires_admin_review
    : false
  if (
    allowedPaymentModes.length === 0 ||
    capabilities.can_change_plan !== true ||
    migrationRequiresAdminReview ||
    capabilities.has_migration_conflict
  ) {
    return 'unavailable'
  }
  if (planRecord.relation === 'upgrade') return 'upgrade_now'
  if (planRecord.relation === 'downgrade') {
    if (
      hasLifecycle &&
      lifecycle.contract?.payment_mode !== 'stripe_recurring'
    ) {
      return 'unavailable'
    }
    return 'downgrade_next_period'
  }
  return 'unavailable'
}

export function getAllowedPaymentModes(
  plan: PlanRecord['plan'],
  topupInfo: TopupInfo | null,
  capabilities: WalletSelfSubscriptionData['capabilities']
): ChangePlanPaymentMode[] {
  const configuredModes = plan.payment_modes ?? []

  const modes: ChangePlanPaymentMode[] = []
  if (
    configuredModes.includes('stripe_recurring') &&
    !!topupInfo?.enable_stripe_topup &&
    capabilities.can_use_stripe_recurring
  ) {
    modes.push('stripe_recurring')
  }
  if (
    (configuredModes.includes('prepaid') ||
      configuredModes.includes('balance_one_period')) &&
    capabilities.can_use_balance_one_period
  ) {
    modes.push(
      configuredModes.includes('prepaid') ? 'prepaid' : 'balance_one_period'
    )
  }
  return modes
}
