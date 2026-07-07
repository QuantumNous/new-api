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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  AutoGroupConfig,
  AutoGroupDashboard,
  AutoGroupIdentityRulesResponse,
  AutoGroupInitApplyPayload,
  AutoGroupInitApplyResult,
  AutoGroupInitPreview,
  AutoGroupReplayResult,
  AutoGroupResolveResult,
  AutoGroupRule,
  AutoGroupSuggestionsResponse,
  RuleFormData,
} from './types'

// Re-export getGroups so consumers can import all group-related APIs from one place
export { getGroups } from '@/features/users/api'

// ============================================================================
// Auto Group Rule CRUD APIs
// ============================================================================

/**
 * List all auto group rules.
 */
export async function getAutoGroupRules(): Promise<
  ApiResponse<AutoGroupRule[]>
> {
  const res = await api.get('/api/auto-group/rules')
  return res.data
}

/**
 * Create a new auto group rule.
 */
export async function createAutoGroupRule(
  data: RuleFormData
): Promise<ApiResponse<AutoGroupRule>> {
  const res = await api.post('/api/auto-group/rules', data)
  return res.data
}

/**
 * Update an existing auto group rule.
 */
export async function updateAutoGroupRule(
  id: number,
  data: RuleFormData
): Promise<ApiResponse<AutoGroupRule>> {
  const res = await api.put(`/api/auto-group/rules/${id}`, data)
  return res.data
}

/**
 * Delete an auto group rule.
 */
export async function deleteAutoGroupRule(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/auto-group/rules/${id}`)
  return res.data
}

// ============================================================================
// Resolve (Test Match) API
// ============================================================================

/**
 * Test-match a job title against existing rules.
 */
export async function resolveAutoGroup(
  jobTitle: string
): Promise<ApiResponse<AutoGroupResolveResult>> {
  const res = await api.get(
    `/api/auto-group/resolve?job_title=${encodeURIComponent(jobTitle)}`
  )
  return res.data
}

// ============================================================================
// Protected Groups Config APIs
// ============================================================================

/**
 * Read the auto group config (protected groups).
 */
export async function getAutoGroupConfig(): Promise<
  ApiResponse<AutoGroupConfig>
> {
  const res = await api.get('/api/auto-group/config')
  return res.data
}

/**
 * Update the auto group config (protected groups).
 */
export async function updateAutoGroupConfig(
  data: AutoGroupConfig
): Promise<ApiResponse<AutoGroupConfig>> {
  const res = await api.put('/api/auto-group/config', data)
  return res.data
}

// ============================================================================
// Initialize (One-click) APIs
// ============================================================================

/**
 * Preview the one-click initialization: scan existing users' job titles and
 * suggest group mappings.
 */
export async function initializePreview(): Promise<
  ApiResponse<AutoGroupInitPreview>
> {
  const res = await api.post('/api/auto-group/initialize/preview')
  return res.data
}

/**
 * Apply (save) the selected initialization rules.
 */
export async function initializeApply(
  payload: AutoGroupInitApplyPayload
): Promise<ApiResponse<AutoGroupInitApplyResult>> {
  const res = await api.post('/api/auto-group/initialize/apply', payload)
  return res.data
}

export async function getAutoGroupDashboard(): Promise<
  ApiResponse<AutoGroupDashboard>
> {
  const res = await api.get('/api/auto-group/dashboard')
  return res.data
}

export async function replayAutoGroupSuggestions(): Promise<
  ApiResponse<AutoGroupReplayResult>
> {
  const res = await api.post('/api/auto-group/replay')
  return res.data
}

export async function applyHighConfidenceSuggestions(): Promise<
  ApiResponse<{ applied: number }>
> {
  const res = await api.post('/api/auto-group/apply-high-confidence')
  return res.data
}

export async function getAutoGroupSuggestions(
  status = 'pending'
): Promise<ApiResponse<AutoGroupSuggestionsResponse>> {
  const res = await api.get(`/api/auto-group/suggestions?status=${status}`)
  return res.data
}

export async function confirmAutoGroupSuggestion(
  id: number,
  group: string
): Promise<ApiResponse> {
  const res = await api.post(`/api/auto-group/suggestions/${id}/confirm`, {
    group,
  })
  return res.data
}

export async function skipAutoGroupSuggestion(id: number): Promise<ApiResponse> {
  const res = await api.post(`/api/auto-group/suggestions/${id}/skip`)
  return res.data
}

export async function getAutoGroupIdentityRules(): Promise<
  ApiResponse<AutoGroupIdentityRulesResponse>
> {
  const res = await api.get('/api/auto-group/identity-rules')
  return res.data
}
