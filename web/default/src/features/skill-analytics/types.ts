/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/

export type DateRangePreset = '24h' | '7d' | '30d'

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
  recharge_to_first_use_rate: number | null
  recharge_to_first_use_conversions: number
  recharge_count: number
  median_time_to_first_use_seconds: number | null
  skill_use_to_repeat_recharge_rate: number | null
  skill_use_to_repeat_recharge_users: number
  skill_use_to_repeat_recharge_user_cohort: number
  charging_enabled: boolean
  data_freshness: DataFreshness
  period_start: string
  period_end: string
}

export interface SkillAnalyticsSkillRow {
  skill_id: string
  skill_name: string
  status: string
  required_plan: string
  enabled_users: number
  saved_users: number
  saved_but_unused_users: number
  active_users: number
  successful_runs: number
  detail_ctr: number | null
  enable_rate: number | null
  first_use_rate: number | null
  repeat_use_rate: number | null
  block_rate: number | null
  revenue_attribution_usd: number | null
  recharge_to_first_use_rate: number | null
  recharge_to_first_use_conversions: number
  recharge_count: number
  median_time_to_first_use_seconds: number | null
  skill_use_to_repeat_recharge_rate: number | null
  skill_use_to_repeat_recharge_users: number
  skill_use_to_repeat_recharge_user_cohort: number
}

export interface SkillAnalyticsSkillsResponse {
  skills: SkillAnalyticsSkillRow[]
  pagination: {
    page: number
    limit: number
    total: number
    has_next: boolean
  }
  charging_enabled: boolean
  period_start: string
  period_end: string
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
