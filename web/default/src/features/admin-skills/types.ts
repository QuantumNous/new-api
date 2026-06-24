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
import type {
  MarketplaceListResponse,
  SkillPlan,
  SkillStatus,
} from '@/features/marketplace/types'

export type AdminSkillKidsApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'emergency_approved'
  | 'rejected'
  | 'revoked'

export type AdminSkillMonetizationType =
  | 'free'
  | 'plan_included'
  | 'token_markup'

export interface AdminSkill {
  id: string
  slug: string
  name: string
  category: string
  short_description?: string
  description?: string
  tags?: unknown[]
  icon_url?: string | null
  required_plan: SkillPlan
  status: SkillStatus
  monetization_type: AdminSkillMonetizationType
  price_markup: number
  free_quota_per_month?: number | null
  max_input_tokens?: number | null
  timeout_seconds: number
  timeout_risk: boolean
  is_kids_safe: boolean
  is_kids_exclusive: boolean
  kids_approval_status: AdminSkillKidsApprovalStatus
  ai_disclosure_required: boolean
  featured_flag: boolean
  featured_rank?: number | null
  active_version_id?: string | null
  created_by: number
  updated_by?: number | null
  created_at: string
  updated_at: string
  published_at?: string | null
  deprecated_at?: string | null
  archived_at?: string | null
  input_hints?: unknown[]
  example_inputs?: unknown[]
  example_outputs?: unknown[]
  model_whitelist?: unknown[]
}

export type AdminSkillListResponse = MarketplaceListResponse<AdminSkill>

export interface AdminSkillListParams {
  page?: number
  limit?: number
  status?: SkillStatus
  required_plan?: SkillPlan
  kids_approval_status?: AdminSkillKidsApprovalStatus
}

export interface AdminSkillDraftPayload {
  slug: string
  name: string
  short_description: string
  description: string
  category: string
  required_plan: SkillPlan
  monetization_type: AdminSkillMonetizationType
  price_markup?: number
  free_quota_per_month?: number | null
  max_input_tokens?: number | null
}

export interface AdminSkillPatchPayload {
  name?: string
  short_description?: string
  description?: string
  category?: string
  tags?: unknown[]
  icon_url?: string | null
  input_hints?: unknown[]
  example_inputs?: unknown[]
  example_outputs?: unknown[]
  required_plan?: SkillPlan
  monetization_type?: AdminSkillMonetizationType
  price_markup?: number
  free_quota_per_month?: number | null
  max_input_tokens?: number | null
  model_whitelist?: unknown[]
  timeout_seconds?: number
  is_kids_safe?: boolean
  is_kids_exclusive?: boolean
  kids_approval_status?: AdminSkillKidsApprovalStatus
  ai_disclosure_required?: boolean
  featured_flag?: boolean
  featured_rank?: number | null
}

export interface AdminSkillVersion {
  id: string
  skill_id: string
  version_number: number
  status: 'draft' | 'active' | 'inactive' | 'archived'
  instruction_template_sha256: string
  has_prompt_guard_template: boolean
  has_output_schema: boolean
  model_whitelist_snapshot: unknown[]
  required_plan_snapshot: SkillPlan
  monetization_snapshot: Record<string, unknown>
  max_input_tokens_snapshot?: number | null
  rollout_percentage: number
  experiment_name?: string | null
  created_by: number
  created_at: string
  activated_at?: string | null
  archived_at?: string | null
}

export interface AdminSkillVersionDetail extends AdminSkillVersion {
  instruction_template: string
  prompt_guard_template?: string | null
  output_schema?: unknown | null
}

export interface AdminSkillVersionPayload {
  instruction_template: string
  output_schema?: unknown | null
}

export interface AdminSkillAuditEntry {
  id: string
  skill_id?: string | null
  skill_version_id?: string | null
  actor_id: number
  actor_role: string
  action: string
  action_reason?: string | null
  changed_fields: string[]
  request_id?: string | null
  created_at: string
}
