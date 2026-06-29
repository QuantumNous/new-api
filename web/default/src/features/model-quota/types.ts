import { z } from 'zod'

export const matchModeSchema = z.enum(['exact', 'prefix'])
export type MatchMode = z.infer<typeof matchModeSchema>

export const modelQuotaPeriodSchema = z.enum(['total', 'daily', 'weekly', 'monthly'])
export type ModelQuotaPeriod = z.infer<typeof modelQuotaPeriodSchema>

export const modelQuotaGroupRuleSchema = z.object({
  id: z.number(),
  group_name: z.string(),
  model_pattern: z.string(),
  match_mode: matchModeSchema,
  period: modelQuotaPeriodSchema.default('total'),
  quota_limit: z.number(),
  enabled: z.boolean(),
  sort_order: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})
export type ModelQuotaGroupRule = z.infer<typeof modelQuotaGroupRuleSchema>

export const modelQuotaPlanRuleSchema = z.object({
  id: z.number(),
  plan_id: z.number(),
  model_pattern: z.string(),
  match_mode: matchModeSchema,
  quota_limit: z.number(),
  enabled: z.boolean(),
  sort_order: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})
export type ModelQuotaPlanRule = z.infer<typeof modelQuotaPlanRuleSchema>

export const userModelQuotaUsageSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  rule_id: z.number(),
  rule_source: z.string(),
  model_pattern: z.string(),
  subscription_id: z.number(),
  quota_limit: z.number(),
  quota_used: z.number(),
  quota_remain: z.number().optional(),
  usage_percent: z.number().optional(),
  period_start: z.number(),
  period_end: z.number(),
  status: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
})
export type UserModelQuotaUsage = z.infer<typeof userModelQuotaUsageSchema>

export interface GetGroupRulesParams {
  group_name?: string
  p?: number
  page_size?: number
}

export interface GetPlanRulesParams {
  plan_id?: number
  p?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
  success: boolean
  data?: {
    items: T[]
    total: number
    page: number
    page_size: number
  }
}

export interface CreateGroupRuleParams {
  group_name: string
  model_pattern: string
  match_mode: MatchMode
  period: ModelQuotaPeriod
  quota_limit: number
  enabled?: boolean
  sort_order?: number
}

export interface CreatePlanRuleParams {
  plan_id: number
  model_pattern: string
  match_mode: MatchMode
  quota_limit: number
  enabled?: boolean
  sort_order?: number
}

export type ModelQuotaDialogType = 'create-group' | 'update-group' | 'delete-group' | 'create-plan' | 'update-plan' | 'delete-plan' | 'user-usage' | 'reset-usage'
