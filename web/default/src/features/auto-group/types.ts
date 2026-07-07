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

// ============================================================================
// Rule Entity
// ============================================================================

export interface AutoGroupRule {
  id: number
  job_title: string
  target_group: string
  enabled: boolean
  priority: number
  remark: string
  created_at: string
  updated_at: string
}

// ============================================================================
// Initialize Preview Item
// ============================================================================

export interface AutoGroupInitItem {
  job_title: string
  suggested_group: string
  user_count: number
  group_distribution: Record<string, number>
  conflict: boolean
  exists: boolean
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface RuleFormData {
  job_title: string
  target_group: string
  enabled?: boolean
  priority?: number
  remark?: string
}

export interface AutoGroupConfig {
  protected_groups: string[]
}

export interface AutoGroupResolveResult {
  matched: boolean
  target_group: string
}

export interface AutoGroupInitPreview {
  items: AutoGroupInitItem[]
  protected_groups: string[]
}

export interface AutoGroupInitApplyPayload {
  rules: Array<{
    job_title: string
    target_group: string
    remark?: string
  }>
}

export interface AutoGroupInitApplyResult {
  saved: number
}

export interface AutoGroupDashboard {
  total_users: number
  auto_apply_count: number
  confirm_required_count: number
  skip_count: number
  protected_count: number
}

export interface AutoGroupReplayResult {
  total_users: number
  auto_apply_count: number
  confirm_required_count: number
  skip_count: number
}

export interface AutoGroupSuggestion {
  id: number
  user_id: number
  username: string
  display_name: string
  email: string
  current_group: string
  suggested_group: string
  confidence: 'high' | 'medium' | 'low'
  action: 'auto_apply' | 'confirm_required' | 'skip'
  reason: string
  source: string
  status: string
  job_title: string
  org_level1_name: string
  org_level2_name: string
  department_name: string
  parent_department_name: string
  org_path: string
}

export interface AutoGroupSuggestionsResponse {
  items: AutoGroupSuggestion[]
}

export interface AutoGroupIdentityRule {
  name: string
  target_group: string
  description: string
  manual_only: boolean
}

export interface AutoGroupIdentityRulesResponse {
  items: AutoGroupIdentityRule[]
}

export interface FeishuGroupOption {
  id: string
  group_id: string
  name: string
}

export interface FeishuGroupsResponse {
  items: FeishuGroupOption[]
}

export interface FeishuGroupPackageMapping {
  id: number
  feishu_group_id: string
  feishu_group_name: string
  target_group: string
  enabled: boolean
  priority: number
  remark: string
  created_at: number
  updated_at: number
}

export interface FeishuGroupPackageMappingsResponse {
  items: FeishuGroupPackageMapping[]
}

export interface FeishuGroupPackageMappingPayload {
  feishu_group_id: string
  feishu_group_name: string
  target_group: string
  enabled?: boolean
  priority?: number
  remark?: string
}

// ============================================================================
// Dialog Types
// ============================================================================

export type RulesDialogType = 'create' | 'update' | 'delete'
