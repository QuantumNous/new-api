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

export type SkillPlan = 'free' | 'pro' | 'enterprise'

export type SkillStatus = 'draft' | 'published' | 'deprecated' | 'archived'

export type SkillCTAAction =
  | 'view'
  | 'download'
  | 'enable'
  | 'use'
  | 'upgrade'
  | 'renew'
  | 'contact_sales'
  | 'login'
  | 'unavailable'

export type SkillGrowthEntryPoint =
  | 'marketplace_card'
  | 'skill_detail'
  | 'search_results'
  | 'new'
  | 'recommended'

export type SkillGrowthEventType = 'skill_impression' | 'skill_detail_view'

export type SkillLockReason =
  | 'auth_required'
  | 'plan_required'
  | 'subscription_inactive'
  | 'quota_exceeded'
  | 'kids_blocked'
  | 'kids_mode_blocked'
  | 'skill_not_enabled'
  | 'skill_not_published'
  | 'SKILL_AUTH_REQUIRED'
  | 'AUTH_REQUIRED'
  | 'SKILL_PLAN_REQUIRED'
  | 'SKILL_SUBSCRIPTION_INACTIVE'
  | 'SKILL_QUOTA_EXCEEDED'
  | 'SKILL_KIDS_MODE_BLOCKED'
  | 'SKILL_NOT_ENABLED'
  | 'SKILL_NOT_PUBLISHED'

export type KidsBadgeState =
  | 'kids_safe'
  | 'kids_exclusive'
  | 'pending'
  | 'blocked'

export interface SkillAvailability {
  enabled?: boolean | null
  executable?: boolean
  locked?: boolean
  lock_code?: SkillLockReason | string | null
  cta?: SkillCTAAction | string | null
}

export interface MarketplaceSkill {
  id: string
  slug: string
  name: string
  category: string
  short_description?: string
  description?: string
  required_plan: SkillPlan
  status?: SkillStatus
  availability?: SkillAvailability
  badges?: string[]
  featured?: boolean
  featured_flag?: boolean
  is_kids_safe?: boolean
  is_kids_exclusive?: boolean
  ai_disclosure_required?: boolean
  published_at?: string | null
}

export interface MySkill extends MarketplaceSkill {
  skill_id?: string
  skill_status?: SkillStatus
  enabled?: boolean
  enabled_at?: string | null
  last_used_at?: string | null
}

export interface MarketplacePagination {
  page: number
  limit: number
  total: number
  has_next: boolean
}

export interface MarketplaceListResponse<T> {
  data: T[]
  pagination?: MarketplacePagination
  meta?: {
    request_id?: string
  }
}

export interface MarketplaceErrorResponse {
  error?: {
    code?: string
    message?: string
    request_id?: string
    retry_after?: number | null
  }
}
