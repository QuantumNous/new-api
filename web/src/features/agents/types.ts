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

import type { UsageLog } from '@/features/usage-logs/data/schema'

const integer = z.number().int()
const nonnegativeInteger = integer.nonnegative()
const positiveInteger = integer.positive()

/** Public point values are decimal strings; JavaScript numbers are rejected. */
export const agentMoneySchema = z.string().regex(/^-?\d+\.\d{2}$/)
export const agentNonnegativeMoneySchema = z.string().regex(/^\d+\.\d{2}$/)

export const agentAccountStatusSchema = z.enum(['active', 'disabled'])
export const agentOrderStatusSchema = z.enum([
  'completed',
  'partially_refunded',
  'refunded',
])
export const agentCodeStatusSchema = z.enum([
  'unused',
  'used',
  'refunded',
  'expired',
])
export const agentCreditEventSchema = z.enum([
  'admin_credit',
  'admin_debit',
  'purchase',
  'refund',
])

export type AgentCodeStatus = z.infer<typeof agentCodeStatusSchema>

export type ApiResult<T> =
  | { success: true; message: string; data: T }
  | { success: false; message: string }

export interface AgentPage<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export const agentOverviewSchema = z
  .object({
    status: agentAccountStatusSchema,
    balance: agentNonnegativeMoneySchema,
    daily_code_limit: positiveInteger,
    daily_code_count: nonnegativeInteger,
    daily_remaining: nonnegativeInteger,
    next_daily_reset_at: nonnegativeInteger,
    account_last_updated: nonnegativeInteger,
  })
  .strict()

export const agentSubscriptionPlanSchema = z
  .object({
    id: positiveInteger,
    title: z.string(),
    subtitle: z.string(),
    price_amount: z.number(),
    currency: z.string(),
    duration_unit: z.string(),
    duration_value: integer,
    custom_seconds: integer,
    enabled: z.boolean(),
    sort_order: integer,
    allow_balance_pay: z.boolean().nullable(),
    allow_wallet_overflow: z.boolean().nullable(),
    stripe_price_id: z.string(),
    creem_product_id: z.string(),
    waffo_pancake_product_id: z.string(),
    max_purchase_per_user: integer,
    upgrade_group: z.string(),
    downgrade_group: z.string(),
    total_amount: integer,
    quota_reset_period: z.string(),
    quota_reset_custom_seconds: integer,
    created_at: nonnegativeInteger,
    updated_at: nonnegativeInteger,
  })
  .strict()

export const agentOfferSchema = z
  .object({
    id: positiveInteger,
    plan_id: positiveInteger,
    enabled: z.boolean(),
    unit_price: agentNonnegativeMoneySchema,
    code_valid_days: positiveInteger,
    refund_fee_bps: integer.min(0).max(10_000),
    plan: agentSubscriptionPlanSchema,
    created_at: nonnegativeInteger,
    updated_at: nonnegativeInteger,
  })
  .strict()

export const agentOrderSchema = z
  .object({
    id: positiveInteger,
    order_no: z.string(),
    agent_user_id: positiveInteger,
    plan_id: positiveInteger,
    plan_title: z.string(),
    quantity: positiveInteger,
    unit_price: agentNonnegativeMoneySchema,
    total_price: agentNonnegativeMoneySchema,
    code_valid_days: positiveInteger,
    refund_fee_bps: integer.min(0).max(10_000),
    refunded_count: nonnegativeInteger,
    refunded_amount: agentNonnegativeMoneySchema,
    status: agentOrderStatusSchema,
    created_at: nonnegativeInteger,
    updated_at: nonnegativeInteger,
  })
  .strict()

export const agentPurchasedOrderSchema = z
  .object({
    id: positiveInteger,
    order_no: z.string(),
    plan_id: positiveInteger,
    plan_title: z.string(),
    quantity: positiveInteger,
    unit_price: agentNonnegativeMoneySchema,
    total_price: agentNonnegativeMoneySchema,
    code_valid_days: positiveInteger,
    refund_fee_bps: integer.min(0).max(10_000),
    status: agentOrderStatusSchema,
    created_at: nonnegativeInteger,
  })
  .strict()

export const agentCodeSchema = z
  .object({
    id: positiveInteger,
    code: z.string(),
    agent_user_id: positiveInteger,
    order_id: positiveInteger,
    order_no: z.string(),
    plan_id: positiveInteger,
    plan_title: z.string(),
    status: agentCodeStatusSchema,
    code_visible: z.boolean(),
    used_user_id: nonnegativeInteger,
    created_at: nonnegativeInteger,
    expired_at: nonnegativeInteger,
    redeemed_at: nonnegativeInteger,
  })
  .strict()

export const agentPurchasedCodeSchema = z
  .object({
    id: positiveInteger,
    key: z.string(),
    name: z.string(),
    status: integer,
    subscription_plan_id: positiveInteger,
    created_time: nonnegativeInteger,
    expired_time: nonnegativeInteger,
  })
  .strict()

export const agentCreditLogSchema = z
  .object({
    id: positiveInteger,
    agent_user_id: positiveInteger,
    delta: agentMoneySchema,
    balance_before: agentNonnegativeMoneySchema,
    balance_after: agentNonnegativeMoneySchema,
    event_type: agentCreditEventSchema,
    business_key: z.string(),
    order_id: nonnegativeInteger,
    redemption_id: nonnegativeInteger,
    operator_user_id: nonnegativeInteger,
    remark: z.string(),
    created_at: nonnegativeInteger,
  })
  .strict()

export const adminAgentSchema = z
  .object({
    id: positiveInteger,
    user_id: positiveInteger,
    username: z.string().optional(),
    display_name: z.string().optional(),
    status: agentAccountStatusSchema,
    balance: agentNonnegativeMoneySchema,
    daily_code_limit: positiveInteger,
    daily_count_date: z.string(),
    daily_code_count: nonnegativeInteger,
    version: nonnegativeInteger,
    created_at: nonnegativeInteger,
    updated_at: nonnegativeInteger,
  })
  .strict()

export const agentReconciliationSchema = z
  .object({
    agent_user_id: positiveInteger,
    balance: agentNonnegativeMoneySchema,
    ledger_sum: agentMoneySchema,
    difference: agentMoneySchema,
    ledger_count: nonnegativeInteger,
    ledger_continuous: z.boolean(),
    matches: z.boolean(),
  })
  .strict()

export const agentPurchaseResponseSchema = z
  .object({
    order: agentPurchasedOrderSchema,
    codes: z.array(agentPurchasedCodeSchema),
    balance_after: agentNonnegativeMoneySchema,
  })
  .strict()

export const agentRefundResponseSchema = z
  .object({
    request_id: positiveInteger,
    redemption_ids: z.array(positiveInteger),
    fee: agentNonnegativeMoneySchema,
    refunded: agentNonnegativeMoneySchema,
    balance_after: agentNonnegativeMoneySchema,
  })
  .strict()

export const agentCreditAdjustmentResponseSchema = z
  .object({
    account: z.object({ balance: agentNonnegativeMoneySchema }).strict(),
    log: agentCreditLogSchema,
  })
  .strict()

export const agentPromotionSchema = z
  .object({
    aff_code: z.string(),
    register_link: z.string(),
    bound_customer_count: nonnegativeInteger,
    month_bound_customer_count: nonnegativeInteger,
  })
  .strict()

export const agentCustomerSchema = z
  .object({
    id: positiveInteger,
    username: z.string(),
    display_name: z.string(),
    status: integer,
    created_at: nonnegativeInteger,
    last_login_at: nonnegativeInteger,
    quota: integer,
    used_quota: integer,
    remaining_quota: nonnegativeInteger,
    bound_at: nonnegativeInteger,
    subscription_plan_title: z.string().optional().default(''),
    subscription_end_time: nonnegativeInteger.optional().default(0),
  })
  .strict()

export const agentCustomerLogStatsSchema = z
  .object({
    quota: integer,
    rpm: nonnegativeInteger,
    tpm: nonnegativeInteger,
  })
  .strict()

export const typedRedemptionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('quota'), quota: integer }).strict(),
  z
    .object({
      type: z.literal('subscription'),
      subscription_id: positiveInteger,
      plan_title: z.string(),
      end_time: positiveInteger,
    })
    .strict(),
])

export const apiFailureSchema = z
  .object({
    success: z.literal(false),
    message: z.string(),
  })
  .strict()

export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion('success', [
    z
      .object({
        success: z.literal(true),
        message: z.string(),
        data: dataSchema,
      })
      .strict(),
    apiFailureSchema,
  ])
}

export function agentPageSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      page: positiveInteger,
      page_size: positiveInteger,
      total: nonnegativeInteger,
      items: z.array(itemSchema),
    })
    .strict()
}

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => new TextEncoder().encode(value).length <= 96)

export const agentPurchaseRequestSchema = z
  .object({
    plan_id: positiveInteger,
    quantity: integer.min(1).max(100),
    idempotency_key: idempotencyKeySchema,
  })
  .strict()

export const agentRefundRequestSchema = z
  .object({
    redemption_ids: z.array(positiveInteger).min(1).max(100),
    idempotency_key: idempotencyKeySchema,
  })
  .strict()

export const adminAgentRefundRequestSchema = agentRefundRequestSchema.extend({
  agent_user_id: positiveInteger,
})

const positiveAgentPointInputSchema = z
  .string()
  .regex(/^\d+(?:\.\d{0,2})?$/)
  .refine((value) => !/^0+(?:\.0{0,2})?$/.test(value))

const agentAdjustmentReasonSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => [...value].length <= 255)

export const agentCreditAdjustmentRequestSchema = z
  .object({
    amount: positiveAgentPointInputSchema,
    direction: z.enum(['credit', 'debit']),
    reason: agentAdjustmentReasonSchema,
    idempotency_key: idempotencyKeySchema,
  })
  .strict()

export const agentOfferUpsertRequestSchema = z
  .object({
    enabled: z.boolean(),
    unit_price: positiveAgentPointInputSchema,
    code_valid_days: integer.min(1).max(3650).optional(),
    refund_fee_bps: integer.min(0).max(10_000),
  })
  .strict()

export const agentDailyLimitRequestSchema = z
  .object({ daily_code_limit: positiveInteger })
  .strict()

export const typedRedemptionRequestSchema = z
  .object({ key: z.string().trim().min(1) })
  .strict()

export type AgentOverview = z.infer<typeof agentOverviewSchema>
export type AgentOffer = z.infer<typeof agentOfferSchema>
export type AgentOrder = z.infer<typeof agentOrderSchema>
export type AgentCode = z.infer<typeof agentCodeSchema>
export type AgentCreditLog = z.infer<typeof agentCreditLogSchema>
export type AdminAgent = z.infer<typeof adminAgentSchema>
export type AgentReconciliation = z.infer<typeof agentReconciliationSchema>
export type AgentPurchaseResponse = z.infer<typeof agentPurchaseResponseSchema>
export type AgentRefundResponse = z.infer<typeof agentRefundResponseSchema>
export type AgentCreditAdjustmentResponse = z.infer<
  typeof agentCreditAdjustmentResponseSchema
>
export type AgentPromotion = z.infer<typeof agentPromotionSchema>
export type AgentCustomer = z.infer<typeof agentCustomerSchema>
export type AgentCustomerLog = UsageLog
export type AgentCustomerLogStats = z.infer<typeof agentCustomerLogStatsSchema>
export type TypedRedemption = z.infer<typeof typedRedemptionSchema>
export type AgentPurchaseRequest = z.input<typeof agentPurchaseRequestSchema>
export type AgentRefundRequest = z.input<typeof agentRefundRequestSchema>
export type AdminAgentRefundRequest = z.input<
  typeof adminAgentRefundRequestSchema
>
export type AgentCreditAdjustmentRequest = z.input<
  typeof agentCreditAdjustmentRequestSchema
>
export type AgentOfferUpsertRequest = z.input<
  typeof agentOfferUpsertRequestSchema
>
export type AgentDailyLimitRequest = z.input<
  typeof agentDailyLimitRequestSchema
>
export type TypedRedemptionRequest = z.input<
  typeof typedRedemptionRequestSchema
>

export interface AgentPageParams {
  p?: number
  page_size?: number
  start_timestamp?: number
  end_timestamp?: number
}

export interface AgentOrderParams extends AgentPageParams {
  agent_user_id?: number
  plan_id?: number
  status?: z.infer<typeof agentOrderStatusSchema>
}

export interface AgentCodeParams extends AgentPageParams {
  agent_user_id?: number
  plan_id?: number
  order_id?: number
  status?: AgentCodeStatus
}

export interface AgentCreditLogParams extends AgentPageParams {
  event_type?: z.infer<typeof agentCreditEventSchema>
}

export interface AgentCustomerParams {
  p?: number
  page_size?: number
  keyword?: string
  sort_by?: 'status' | 'remaining_quota' | 'subscription_end_time' | 'bound_at'
  sort_order?: 'asc' | 'desc'
}

export interface AgentCustomerLogParams extends AgentPageParams {
  user_id?: number
  username?: string
  type?: number
  model_name?: string
  token_name?: string
  group?: string
}

export interface AdminAgentParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: z.infer<typeof agentAccountStatusSchema>
}
