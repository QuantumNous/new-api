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

// ============================================================================
// Dialog Types
// ============================================================================

export type RulesDialogType = 'create' | 'update' | 'delete'
