/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import { api } from '@/lib/api'
import type {
  DateRange,
  SkillAnalyticsOverview,
  SkillAnalyticsSkillsResponse,
} from './types'

/** DR-75 contract: GET /api/v1/ops/skill-analytics/overview */
export async function getSkillAnalyticsOverview(
  range: DateRange
): Promise<SkillAnalyticsOverview> {
  const res = await api.get('/api/v1/ops/skill-analytics/overview', {
    params: { start: range.start, end: range.end },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/** DR-96 contract: GET /api/v1/ops/skill-analytics/skills */
export async function getSkillAnalyticsSkills(
  range: DateRange
): Promise<SkillAnalyticsSkillsResponse> {
  const res = await api.get('/api/v1/ops/skill-analytics/skills', {
    params: { start: range.start, end: range.end, limit: 8 },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

export async function getMostSavedSkillAnalytics(
  range: DateRange
): Promise<SkillAnalyticsSkillsResponse> {
  const res = await api.get('/api/v1/ops/skill-analytics/skills', {
    params: {
      start: range.start,
      end: range.end,
      sort: 'most_saved',
      limit: 5,
    },
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
