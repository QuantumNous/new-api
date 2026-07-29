import { cancelSubscriptionRenewal, resumeSubscriptionRenewal } from './api'
import type {
  RecurringSubscription,
  SelfSubscriptionData,
  SelfSubscriptionDataResponse,
  SelfRecurringSubscription,
  SubscriptionRenewalLifecyclePrecondition,
  SubscriptionRenewalLifecycleResult,
  UserSubscriptionRecord,
} from './types'

export const recurringSubscriptionContract = {
  binding_id: 1,
  provider: 'stripe',
  plan_id: 2,
  provider_status: 'active',
  cancel_at_period_end: false,
  current_period_start: 1000,
  current_period_end: 2000,
  grace_period_end: 0,
  can_cancel: true,
  can_resume: false,
  requires_support: false,
} satisfies RecurringSubscription

export const selfRecurringSubscriptionContract = {
  plan_id: 2,
  cancel_at_period_end: false,
  current_period_start: 1000,
  current_period_end: 2000,
  grace_period_end: 0,
  requires_support: false,
} satisfies SelfRecurringSubscription

export const recurringSelfSubscriptionContract: SelfSubscriptionData = {
  billing_preference: 'subscription_first',
  capabilities: {
    can_change_plan: true,
    can_use_stripe_recurring: true,
    can_use_balance_one_period: true,
    migration_required: false,
  },
  migration: {
    required: false,
    blocked: false,
  },
  subscriptions: [],
  all_subscriptions: [],
  recurring_subscriptions: [selfRecurringSubscriptionContract],
}

export const adminSubscriptionContract = {
  subscription: {
    id: 1,
    user_id: 1,
    plan_id: 2,
    status: 'active',
    start_time: 1000,
    end_time: 2000,
    amount_total: 100,
    amount_used: 0,
    provider_binding_id: 1,
  },
  provider_binding: {
    binding_id: 1,
    provider: 'stripe',
    provider_status: 'active',
    cancel_at_period_end: false,
    current_period_end: 2000,
  },
} satisfies UserSubscriptionRecord

type RenewalMutationResponse = Promise<{
  success: boolean
  message?: string
  data?: SubscriptionRenewalLifecycleResult
}>

type RenewalPreconditionParameters = [SubscriptionRenewalLifecyclePrecondition]
type ExactParameterTuple<
  Actual extends readonly unknown[],
  Expected extends readonly unknown[],
> = Actual extends Expected ? (Expected extends Actual ? Actual : never) : never

const cancelSubscriptionRenewalParameters = null as unknown as Parameters<
  typeof cancelSubscriptionRenewal
>

const resumeSubscriptionRenewalParameters = null as unknown as Parameters<
  typeof resumeSubscriptionRenewal
>

const exactCancelSubscriptionRenewalParameters =
  cancelSubscriptionRenewalParameters satisfies ExactParameterTuple<
    Parameters<typeof cancelSubscriptionRenewal>,
    RenewalPreconditionParameters
  >

const exactResumeSubscriptionRenewalParameters =
  resumeSubscriptionRenewalParameters satisfies ExactParameterTuple<
    Parameters<typeof resumeSubscriptionRenewal>,
    RenewalPreconditionParameters
  >

export const providerNeutralRenewalApiContract = {
  cancel: {
    fn: cancelSubscriptionRenewal satisfies (
      ...args: RenewalPreconditionParameters
    ) => RenewalMutationResponse,
    parameters: exactCancelSubscriptionRenewalParameters,
  },
  resume: {
    fn: resumeSubscriptionRenewal satisfies (
      ...args: RenewalPreconditionParameters
    ) => RenewalMutationResponse,
    parameters: exactResumeSubscriptionRenewalParameters,
  },
}

export const providerNeutralRenewalPreconditionContract = {
  expected_contract_id: 1,
  expected_change_version: 2,
  expected_current_period_end: 2000,
  expected_renewal_source: 'provider_recurring',
  expected_renewal_status: 'enabled',
} satisfies SubscriptionRenewalLifecyclePrecondition

export const providerNeutralRenewalResultContract = {
  renewal_source: 'provider_recurring',
  renewal_status: 'enabled',
  current_period_end: 2000,
  change_version: 3,
  can_cancel: true,
  can_resume: false,
  is_cancel_at_period_end: false,
} satisfies SubscriptionRenewalLifecycleResult

export const walletRenewalResultContract = {
  renewal_source: 'wallet_auto',
  renewal_status: 'cancelled_by_user',
  current_period_end: 2000,
  change_version: 3,
  can_cancel: false,
  can_resume: true,
  is_cancel_at_period_end: true,
} satisfies SubscriptionRenewalLifecycleResult

export const pausedMutationResultMustNotTypecheck = {
  renewal_source: 'wallet_auto',
  // @ts-expect-error paused states belong to self-subscription state, not mutation results
  renewal_status: 'paused_insufficient_balance',
  current_period_end: 2000,
  change_version: 3,
  can_cancel: false,
  can_resume: false,
  is_cancel_at_period_end: false,
} satisfies SubscriptionRenewalLifecycleResult

export const legacySelfSubscriptionResponseContract = {
  renewal_source: 'balance',
  renewal_status: 'legacy_paused',
} satisfies SelfSubscriptionDataResponse
