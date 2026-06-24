/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

export type DateRangePreset = '24h' | '7d' | '30d'

export type SkillAnalyticsSortKey =
  | 'skill_name'
  | 'enabled_users'
  | 'active_users'
  | 'successful_runs'
  | 'detail_ctr'
  | 'enable_rate'
  | 'first_use_rate'
  | 'repeat_use_rate'
  | 'one_time_rate'
  | 'block_rate'

export type SkillAnalyticsSort = SkillAnalyticsSortKey | `-${SkillAnalyticsSortKey}`

export type SkillAnalyticsTrend = 'up' | 'down' | 'flat'

export type SkillAnalyticsStatus = 'draft' | 'published' | 'deprecated' | 'archived'

export type SkillAnalyticsPlan = 'free' | 'pro' | 'enterprise'

export type SkillAnalyticsPersona = 'casual' | 'dev' | 'team' | 'unset'

export type BlockReason =
  | 'plan_required'
  | 'subscription_inactive'
  | 'quota_exceeded'
  | 'kids_blocked'
  | 'safety_violation'
  | 'unknown'

export type DataFreshness = 'ok' | 'delayed' | 'failed'

/** DR-75 API contract — GET /api/v1/ops/skill-analytics/overview */
export interface SkillAnalyticsOverview {
  wasu: number | null
  total_skill_runs: number | null
  detail_ctr: number | null
  enable_rate: number | null
  first_use_rate: number | null
  repeat_use_rate: number | null
  block_rate: number | null
  top_block_reason: BlockReason | null
  revenue_attribution_usd: number | null
  charging_enabled: boolean
  data_freshness: DataFreshness
  period_start: string
  period_end: string
}

export interface SkillAnalyticsSkillRow {
  skill_id: string
  skill_name: string
  status: SkillAnalyticsStatus
  required_plan: SkillAnalyticsPlan
  enabled_users: number
  active_users: number
  successful_runs: number
  detail_ctr: number | null
  enable_rate: number | null
  first_use_rate: number | null
  repeat_use_rate: number | null
  one_time_rate: number | null
  block_rate: number | null
  revenue_attribution_usd: number | null
  trend: SkillAnalyticsTrend
}

export interface SkillAnalyticsPagination {
  page: number
  limit: number
  total: number
  has_next: boolean
}

export interface SkillAnalyticsSkillsResponse {
  skills: SkillAnalyticsSkillRow[]
  pagination: SkillAnalyticsPagination
  charging_enabled: boolean
  period_start: string
  period_end: string
}

export interface SkillAnalyticsSkillsParams {
  page?: number
  limit?: number
  sort?: SkillAnalyticsSort
  status?: SkillAnalyticsStatus
  required_plan?: SkillAnalyticsPlan
  plan?: SkillAnalyticsPlan
  persona?: SkillAnalyticsPersona
  q?: string
}

export interface DateRange {
  start: string
  end: string
}

export function getDateRange(preset: DateRangePreset): DateRange {
  const now = new Date()
  const start = new Date(now)
  if (preset === '24h') {
    start.setHours(now.getHours() - 24)
  } else if (preset === '7d') {
    start.setDate(now.getDate() - 7)
  } else {
    start.setDate(now.getDate() - 30)
  }
  return { start: start.toISOString(), end: now.toISOString() }
}

export function getBlockReasonLabelKey(reason: BlockReason): string {
  const labelKeys: Record<BlockReason, string> = {
    plan_required: 'skillAnalytics.blockReason.planRequired',
    subscription_inactive: 'skillAnalytics.blockReason.subscriptionInactive',
    quota_exceeded: 'skillAnalytics.blockReason.quotaExceeded',
    kids_blocked: 'skillAnalytics.blockReason.kidsBlocked',
    safety_violation: 'skillAnalytics.blockReason.safetyViolation',
    unknown: 'skillAnalytics.blockReason.unknown',
  }
  return labelKeys[reason] ?? labelKeys.unknown
}
