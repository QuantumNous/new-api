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

/** DR-75 API contract — GET /api/v1/admin/skill-analytics/overview */
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

export function formatBlockReason(reason: BlockReason): string {
  const labels: Record<BlockReason, string> = {
    plan_required: 'Plan Required',
    subscription_inactive: 'Subscription Inactive',
    quota_exceeded: 'Quota Exceeded',
    kids_blocked: 'Kids Mode Blocked',
    safety_violation: 'Safety Violation',
    unknown: 'Unknown',
  }
  return labels[reason] ?? reason
}
