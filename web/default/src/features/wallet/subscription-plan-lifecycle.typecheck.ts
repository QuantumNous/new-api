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
  SelfSubscriptionDataResponse,
  SubscriptionPlan,
} from '@/features/subscriptions/types'
import {
  type LifecyclePlanRecord,
  type WalletSelfSubscriptionData,
  getAllowedPaymentModes,
  getDisplayedPlanAction,
  normalizeSelfSubscriptionData,
} from './lib/subscription-plan-lifecycle'
import type { TopupInfo } from './types'

const basePlan = {
  id: 1,
  title: 'Pro',
  price_amount: 20,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  quota_reset_period: 'monthly',
  enabled: true,
  sort_order: 1,
  allow_balance_pay: true,
  max_purchase_per_user: 0,
  total_amount: 100,
  window_5h_amount: 0,
  window_week_amount: 0,
  media_credits_monthly: 0,
  model_count: 0,
  rpm: 0,
  concurrency: 0,
  feature_lines: '',
} satisfies SubscriptionPlan

const topupInfo = {
  enable_online_topup: true,
  enable_stripe_topup: true,
  pay_methods: [],
  min_topup: 0,
  stripe_min_topup: 0,
  amount_options: [],
  discount: {},
  bonus: {},
} satisfies TopupInfo

const capabilities = {
  can_change_plan: true,
  can_use_stripe_recurring: true,
  can_use_balance_one_period: true,
  can_cancel: false,
  can_resume: false,
  requires_support: false,
  has_pending_intent: false,
  is_grace: false,
  is_cancel_at_period_end: false,
  has_migration_conflict: false,
  migration_required: false,
} satisfies WalletSelfSubscriptionData['capabilities']

export const stripeModesWithoutProviderId = getAllowedPaymentModes(
  {
    ...basePlan,
    payment_modes: ['stripe_recurring'],
  },
  topupInfo,
  capabilities
)

export const missingSafePaymentModes = getAllowedPaymentModes(
  basePlan,
  topupInfo,
  capabilities
)

export const normalizedBackendSelfSubscription = normalizeSelfSubscriptionData({
  billing_preference: 'subscription_first',
  capabilities: {
    can_change_plan: true,
    can_use_stripe_recurring: true,
    can_use_balance_one_period: true,
    has_migration_conflict: false,
  },
  migration: {
    requires_admin_review: false,
    classification: 'no_active',
    reason: '',
  },
  subscriptions: [],
  all_subscriptions: [],
  recurring_subscriptions: [],
} satisfies SelfSubscriptionDataResponse)

declare const canonicalSelf: WalletSelfSubscriptionData
declare const lifecyclePlan: LifecyclePlanRecord

canonicalSelf.current_entitlement?.entitlement_id.toFixed()
canonicalSelf.current_period?.end.toFixed()
canonicalSelf.quota?.amount_remaining.toFixed()
canonicalSelf.pending_change?.to_plan_id.toFixed()
lifecyclePlan.relation?.toString()

export const backendRelationAction = getDisplayedPlanAction(
  lifecyclePlan,
  canonicalSelf.contract?.current_plan_id || 0,
  ['balance_one_period'],
  canonicalSelf.capabilities
)
