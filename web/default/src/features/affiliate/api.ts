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
import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import {
  buildAffiliateCommissionsQuery,
  buildAffiliateProfilesQuery,
  buildAffiliateRuleSetsQuery,
  buildAffiliateSettlementsQuery,
} from './admin-lib'
import { buildAffiliateLogsQuery } from './lib'
import { buildAffiliateSummaryTrendParams } from './trend-lib'
import type {
  AffiliateLog,
  AffiliateLogsParams,
  AffiliateCommissionAdjustmentPayload,
  AffiliateCommissionEvent,
  AffiliateCommissionFilters,
  AffiliateCommissionRecomputePayload,
  AffiliateCommissionRecomputeResult,
  AffiliateProfile,
  AffiliateProfilePayload,
  AffiliateProfileFilters,
  AffiliateRuleSet,
  AffiliateRuleSetDraftPayload,
  AffiliateRuleSetFilters,
  AffiliateRuleSetRollbackPayload,
  AffiliateSettlement,
  AffiliateSettlementFilters,
  AffiliateSettlementRunPayload,
  AffiliateSettlementRunResult,
  AffiliateStatus,
  AffiliateSummary,
  AffiliateTeamTree,
  ApiResponse,
  PageResponse,
} from './types'

export async function getAffiliateStatus(): Promise<
  ApiResponse<AffiliateStatus>
> {
  const res = await api.get('/api/affiliate/status', {
    skipBusinessError: true,
  })
  return res.data
}

export async function getAffiliateSummary(): Promise<
  ApiResponse<AffiliateSummary>
> {
  const res = await api.get('/api/affiliate/summary', {
    params: buildAffiliateSummaryTrendParams(),
    timeout: 15000,
    skipBusinessError: true,
  })
  return res.data
}

export async function getAffiliateTeamTree(): Promise<
  ApiResponse<AffiliateTeamTree>
> {
  try {
    const res = await api.get('/api/affiliate/team', {
      params: { _t: Date.now() },
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
      skipBusinessError: true,
      skipErrorHandler: true,
    })
    return res.data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return {
        success: false,
        message:
          'Affiliate team tree API returned 404. Restart or deploy the backend version containing /api/affiliate/team.',
        data: { items: [], total: 0 },
      }
    }
    throw error
  }
}

export async function getAffiliateAdminUser(
  userId: number
): Promise<
  ApiResponse<{ id: number; username?: string; display_name?: string }>
> {
  const res = await api.get(`/api/user/${userId}`, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return res.data
}

export async function getAffiliateLogs(
  params: AffiliateLogsParams
): Promise<ApiResponse<PageResponse<AffiliateLog>>> {
  const res = await api.get(buildAffiliateLogsQuery(params), {
    skipBusinessError: true,
  })
  return res.data
}

export async function getAffiliateProfiles(args: {
  page?: number
  pageSize?: number
  filters?: AffiliateProfileFilters
}): Promise<ApiResponse<PageResponse<AffiliateProfile>>> {
  const res = await api.get(buildAffiliateProfilesQuery(args), {
    skipBusinessError: true,
  })
  return res.data
}

export async function setAffiliateProfile(
  payload: AffiliateProfilePayload
): Promise<ApiResponse<AffiliateProfile>> {
  const res = await api.post('/api/affiliate/admin/profiles', payload, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateAffiliateProfileStatus(
  userId: number,
  status: 'active' | 'disabled',
  reason: string
): Promise<ApiResponse<AffiliateProfile | null>> {
  const res = await api.patch(
    `/api/affiliate/admin/profiles/${userId}/status`,
    { status, reason },
    { skipBusinessError: true }
  )
  return res.data
}

export async function getAffiliateRuleSets(args: {
  page?: number
  pageSize?: number
  filters?: AffiliateRuleSetFilters
}): Promise<ApiResponse<PageResponse<AffiliateRuleSet>>> {
  const res = await api.get(buildAffiliateRuleSetsQuery(args), {
    skipBusinessError: true,
  })
  return res.data
}

export async function saveAffiliateRuleSetDraft(
  payload: AffiliateRuleSetDraftPayload
): Promise<ApiResponse<AffiliateRuleSet>> {
  const res = await api.post('/api/affiliate/admin/rule-sets/draft', payload, {
    skipBusinessError: true,
  })
  return res.data
}

export async function updateAffiliateRuleSetStatus(
  ruleSetId: number,
  action: 'publish' | 'archive',
  reason: string
): Promise<ApiResponse<AffiliateRuleSet>> {
  const res = await api.patch(
    `/api/affiliate/admin/rule-sets/${ruleSetId}/${action}`,
    { reason },
    { skipBusinessError: true }
  )
  return res.data
}

export async function rollbackAffiliateRuleSetToDraft(
  ruleSetId: number,
  payload: AffiliateRuleSetRollbackPayload
): Promise<ApiResponse<AffiliateRuleSet>> {
  const res = await api.post(
    `/api/affiliate/admin/rule-sets/${ruleSetId}/rollback-draft`,
    payload,
    { skipBusinessError: true }
  )
  return res.data
}

export async function getAffiliateAdminCommissions(args: {
  page?: number
  pageSize?: number
  filters?: AffiliateCommissionFilters
}): Promise<ApiResponse<PageResponse<AffiliateCommissionEvent>>> {
  const res = await api.get(buildAffiliateCommissionsQuery(args), {
    skipBusinessError: true,
  })
  return res.data
}

export async function getAffiliateAdminSettlements(args: {
  page?: number
  pageSize?: number
  filters?: AffiliateSettlementFilters
}): Promise<ApiResponse<PageResponse<AffiliateSettlement>>> {
  const res = await api.get(buildAffiliateSettlementsQuery(args), {
    skipBusinessError: true,
  })
  return res.data
}

export async function runAffiliateSettlementPipeline(
  payload: AffiliateSettlementRunPayload
): Promise<ApiResponse<AffiliateSettlementRunResult>> {
  const res = await api.post('/api/affiliate/admin/settlement-runs', payload, {
    skipBusinessError: true,
  })
  return res.data
}

export async function recomputeAffiliateCommissions(
  payload: AffiliateCommissionRecomputePayload
): Promise<ApiResponse<AffiliateCommissionRecomputeResult>> {
  const res = await api.post(
    '/api/affiliate/admin/commissions/recompute',
    payload,
    { skipBusinessError: true }
  )
  return res.data
}

export async function createAffiliateCommissionAdjustment(
  payload: AffiliateCommissionAdjustmentPayload
): Promise<ApiResponse<AffiliateCommissionEvent>> {
  const res = await api.post(
    '/api/affiliate/admin/commissions/adjust',
    payload,
    {
      skipBusinessError: true,
    }
  )
  return res.data
}
