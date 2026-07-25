import { cancelRecurringSubscription, resumeRecurringSubscription } from './api'
import type {
  RecurringSubscription,
  SelfSubscriptionData,
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
  recurring_subscriptions: [recurringSubscriptionContract],
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

export const recurringApiContract = {
  cancelRecurringSubscription,
  resumeRecurringSubscription,
}
