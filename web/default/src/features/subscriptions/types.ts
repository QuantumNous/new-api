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
import { z } from 'zod'

// ============================================================================
// Subscription Plan Schema & Types
// ============================================================================

export const subscriptionPlanSchema = z.object({
  id: z.number(),
  title: z.string(),
  subtitle: z.string().optional(),
  price_amount: z.number(),
  currency: z.string().default('USD'),
  pix_price_brl: z.number().nullable().optional(),
  upi_price_inr: z.number().nullable().optional(),
  duration_unit: z.enum(['year', 'month', 'day', 'hour', 'custom']),
  duration_value: z.number(),
  custom_seconds: z.number().optional(),
  quota_reset_period: z.enum(['never', 'daily', 'weekly', 'monthly', 'custom']),
  quota_reset_custom_seconds: z.number().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
  allow_balance_pay: z.boolean().optional().default(true),
  max_purchase_per_user: z.number(),
  total_amount: z.number(),
  window_5h_amount: z.number().optional().default(0),
  window_week_amount: z.number().optional().default(0),
  media_credits_monthly: z.number().optional().default(0),
  upgrade_group: z.string().optional(),
  stripe_price_id: z.string().optional(),
  creem_product_id: z.string().optional(),
  waffo_pancake_product_id: z.string().optional(),
  // 面向用户的价值展示字段（纯展示，不参与计费）
  model_count: z.number().optional().default(0),
  rpm: z.number().optional().default(0),
  concurrency: z.number().optional().default(0),
  feature_lines: z.string().optional().default(''),
  tier_rank: z.number().optional().nullable(),
  payment_modes: z
    .array(
      z.enum([
        'stripe_recurring',
        'prepaid',
        'balance_one_period',
        'external_one_period',
      ])
    )
    .optional(),
})

export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>

export interface PlanRecord {
  plan: SubscriptionPlan
}

// ============================================================================
// User Subscription Schema & Types
// ============================================================================

export const userSubscriptionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  plan_id: z.number(),
  status: z.string(),
  source: z.string().optional(),
  payment_mode: z.string().optional(),
  provider_binding_id: z.number().optional(),
  contract_id: z.number().optional(),
  current_slot: z.number().optional().nullable(),
  start_time: z.number(),
  end_time: z.number(),
  access_end_time: z.number().optional(),
  amount_total: z.number(),
  amount_used: z.number(),
  media_credits_total: z.number().optional(),
  media_credits_used: z.number().optional(),
  next_reset_time: z.number().optional(),
})

export type UserSubscription = z.infer<typeof userSubscriptionSchema>

export interface SubscriptionProviderBindingSummary {
  binding_id: number
  provider: string
  provider_status: string
  cancel_at_period_end: boolean
  current_period_end: number
}

export interface UserSubscriptionRecord {
  subscription: UserSubscription
  provider_binding?: SubscriptionProviderBindingSummary
}

export interface SubscriptionUsageLimits {
  window_5h_used: number
  window_5h_reset_at: number
  window_week_used: number
  window_week_reset_at: number
}

export interface CurrentSubscriptionRecord extends UserSubscriptionRecord {
  plan: SubscriptionPlan
  usage_limits: SubscriptionUsageLimits
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PlanPayload {
  plan: Partial<SubscriptionPlan>
}

export interface SubscriptionPayRequest {
  plan_id: number
  payment_method?: string
  recall_claim?: string
}

export interface SubscriptionPayResponse {
  success: boolean
  message?: string
  data?: {
    // Stripe-style hosted checkout link.
    pay_link?: string
    // Waffo Pancake / Creem hosted checkout URL.
    checkout_url?: string
    // Pancake-only: order metadata + self-service buyer session token,
    // surfaced for future flows (refund / cancel from new-api's own UI).
    session_id?: string
    expires_at?: number | string
    order_id?: string
    token?: string
    token_expires_at?: number | string
  }
  url?: string
}

export type SubscriptionPaymentMode =
  | 'stripe_recurring'
  | 'prepaid'
  | 'balance_one_period'
  | 'external_one_period'

export type ChangePlanPaymentMode =
  | 'stripe_recurring'
  | 'prepaid'
  | 'balance_one_period'

export type FlexiblePaymentChoice =
  | 'stripe_recurring'
  | 'alipay'
  | 'pix'
  | 'upi'
  | 'balance'

export interface FlexiblePurchaseRequest {
  plan_id: number
  payment_choice: FlexiblePaymentChoice
  months: number
  request_id: string
  quote_id?: string
  order_id?: string
  ui_mode?: 'embedded'
}

export interface FlexiblePurchaseResponse {
  status: 'applied' | 'checkout_required' | 'payment_action_required' | 'failed'
  contract?: SubscriptionContract
  intent?: SubscriptionPendingChange
  checkout_url?: string
  hosted_invoice_url?: string
  client_secret?: string
  publishable_key?: string
  start_time?: number
  end_time?: number
  remaining_days?: number
  refundable_not_started_value?: number
  payment_quotes?: SubscriptionPaymentQuotes
}

export interface SubscriptionPaymentQuote {
  currency: string
  months: number
  unit_price: number
  total: number
  quote_id?: string
  order_id?: string
  expires_at?: number
}

export type SubscriptionPaymentQuotes = Partial<
  Record<FlexiblePaymentChoice, SubscriptionPaymentQuote>
>

export type SubscriptionContractStatus =
  | 'active'
  | 'grace'
  | 'ended'
  | 'needs_attention'

export interface SubscriptionContract {
  contract_id: number
  id: number
  user_id?: number
  status: SubscriptionContractStatus
  payment_mode: SubscriptionPaymentMode
  current_plan_id: number
  current_entitlement_id: number
  current_provider_binding_id: number
  latest_change_intent_id: number
  pending_plan_id: number
  pending_effective_at: number
  current_period_start: number
  current_period_end: number
  grace_period_end: number
  change_version: number
  base_user_group?: string
  created_at?: number
  updated_at?: number
}

export interface SubscriptionContractDTO {
  contract_id: number
  status: SubscriptionContractStatus
  payment_mode: SubscriptionPaymentMode
  current_plan_id: number
  current_entitlement_id: number
  current_provider_binding_id: number
  latest_change_intent_id: number
  pending_plan_id: number
  pending_effective_at: number
  change_version: number
}

export interface SubscriptionEntitlement {
  entitlement_id: number
  plan_id: number
  provider_binding_id: number
  status: string
  payment_mode: string
  start_time: number
  end_time: number
  access_end_time: number
}

export interface SubscriptionCurrentPeriod {
  start: number
  end: number
  grace_period_end: number
}

export interface SubscriptionQuota {
  amount_total: number
  amount_used: number
  amount_remaining: number
  unlimited: boolean
  reset_at?: number
}

export interface SubscriptionUsageWindow {
  used?: number
  total?: number
  remaining?: number
  reset_at?: number
  unlimited?: boolean
}

export type SubscriptionPaymentAvailability = Partial<
  Record<
    FlexiblePaymentChoice,
    {
      available?: boolean
      disabled_reason?: string
      reason?: string
    }
  >
>

export interface SubscriptionPendingChange {
  intent_id: number
  request_id: string
  kind: 'purchase' | 'upgrade' | 'downgrade' | 'cancel' | 'resume' | 'terminate'
  status:
    | 'created'
    | 'syncing'
    | 'awaiting_payment'
    | 'scheduled'
    | 'applied'
    | 'failed'
    | 'expired'
    | 'superseded'
    | 'compensation_required'
  from_plan_id: number
  to_plan_id: number
  provider_binding_id: number
  effective_at: number
  payment_mode: SubscriptionPaymentMode
}

export type SubscriptionPendingChangeDTO = Omit<
  SubscriptionPendingChange,
  'request_id'
>

export interface ChangePlanRequest {
  plan_id: number
  payment_mode: ChangePlanPaymentMode
  request_id: string
}

export interface ChangePlanResponse {
  status:
    | 'applied'
    | 'scheduled'
    | 'checkout_required'
    | 'payment_action_required'
  contract: SubscriptionContract
  intent: SubscriptionPendingChange
  checkout_url?: string
  hosted_invoice_url?: string
}

export interface CreateUserSubscriptionRequest {
  plan_id: number
}

export interface RecurringSubscription {
  binding_id: number
  provider: string
  plan_id: number
  provider_status: string
  cancel_at_period_end: boolean
  current_period_start: number
  current_period_end: number
  grace_period_end: number
  can_cancel: boolean
  can_resume: boolean
  requires_support: boolean
}

// ============================================================================
// Self Subscription Data (user-facing)
// ============================================================================

export interface SelfSubscriptionCapabilities {
  can_change_plan: boolean
  can_use_stripe_recurring: boolean
  can_use_balance_one_period: boolean
  can_cancel?: boolean
  can_resume?: boolean
  requires_support?: boolean
  has_pending_intent?: boolean
  is_grace?: boolean
  is_cancel_at_period_end?: boolean
  has_migration_conflict?: boolean
  migration_required: boolean
  migration_blocked_reason?: string
}

export interface SelfSubscriptionMigration {
  required: boolean
  blocked: boolean
  reason?: string
  requires_admin_review?: boolean
  classification?: string
}

export interface SubscriptionMigration {
  requires_admin_review: boolean
  classification: string
  reason: string
}

export interface SelfSubscriptionData {
  billing_preference: string
  billing_order?: ['subscription', 'wallet']
  current_subscription?: CurrentSubscriptionRecord | null
  contract?: SubscriptionContract | null
  current_entitlement?: SubscriptionEntitlement | null
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
  pending_change?: SubscriptionPendingChange | null
  capabilities: SelfSubscriptionCapabilities
  migration: SelfSubscriptionMigration
  subscriptions: UserSubscriptionRecord[]
  all_subscriptions: UserSubscriptionRecord[]
  recurring_subscriptions: RecurringSubscription[]
}

export interface SelfSubscriptionDataResponse extends Partial<
  Omit<SelfSubscriptionData, 'capabilities' | 'migration'>
> {
  capabilities?: Partial<SelfSubscriptionCapabilities> & {
    has_migration_conflict?: boolean
  }
  migration?: Partial<SelfSubscriptionMigration> & {
    requires_admin_review?: boolean
    has_migration_conflict?: boolean
    classification?: string
  }
}

export interface AdminUserSubscriptionsResponse {
  contract?: SubscriptionContractDTO | null
  current_entitlement?: SubscriptionEntitlement | null
  current_period: SubscriptionCurrentPeriod
  quota: SubscriptionQuota
  current_binding?: RecurringSubscription | null
  pending_change?: SubscriptionPendingChangeDTO | null
  migration: SubscriptionMigration
  history: UserSubscriptionRecord[]
}

// ============================================================================
// Dialog Types
// ============================================================================

export type SubscriptionsDialogType = 'create' | 'update' | 'toggle-status'
