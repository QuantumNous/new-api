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

export type MarketplacePlanFilter = 'all' | SkillPlan

export type MarketplaceStatusFilter =
  | 'all'
  | 'available'
  | 'enabled'
  | 'locked'
  | 'unavailable'

export interface MarketplaceFilters {
  query: string
  category: string
  plan: MarketplacePlanFilter
  status: MarketplaceStatusFilter
  kidsSafeOnly: boolean
}

export type SkillCTAAction =
  | 'view'
  | 'download'
  | 'enable'
  | 'use'
  | 'upgrade'
  | 'renew'
  | 'contact_sales'
  | 'login'
  | 'remove'
  | 'unavailable'

export type SkillGrowthEntryPoint =
  | 'marketplace_card'
  | 'skill_detail'
  | 'paywall'
  | 'saved_list'
  | 'search_results'
  | 'new'
  | 'new_week'
  | 'trending'
  | 'recommended'
  | 'reco_personal'
  | 'reco_codownload'
  | 'leaderboard_weekly'
  | 'leaderboard_monthly'

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
  saved?: boolean | null
  is_kids_safe?: boolean
  is_kids_exclusive?: boolean
  ai_disclosure_required?: boolean
  published_at?: string | null
  rating_summary?: RatingSummary
  download_count?: number
}

export interface RatingSummary {
  average: number
  count: number
}

export type DownloadLeaderboardWindow = '7d' | '30d'

export interface DownloadLeaderboardSkill extends MarketplaceSkill {
  download_count: number
  rank: number
  window: DownloadLeaderboardWindow
}

export interface MarketplaceEventPayload {
  event_type: 'skill_impression' | 'skill_detail_view'
  skill_id: string
  entry_point: SkillGrowthEntryPoint
}

export interface SkillPurchaseResponse {
  order_id: string
  skill_id: string
  skill_version_id?: string
  status: string
  entitled: boolean
  amount_usd: number
  currency: string
  quota_charged: number
  monetization_type: string
}

export interface DownloadCTA {
  url: string
  // Backend returns "GET"; kept as string to tolerate future methods.
  method: string
}

export interface SkillVersionInstructions {
  download_instructions: string
  usage_instructions: string
  prerequisites?: unknown[]
  quickstart?: unknown[]
  example_io?: unknown[]
}

// PublicSkillDetail mirrors the backend detail-only response (DR-53):
// PublicSkill fields plus the runtime-dependency flag and download CTA.
// Examples/input hints are intentionally absent — the detail API does not
// expose them yet (DR-53 follow-up).
export interface PublicSkillDetail extends MarketplaceSkill {
  requires_deeprouter_key: boolean
  download_cta: DownloadCTA
  instructions: SkillVersionInstructions
  saved?: boolean
}

export interface SavedSkill {
  skill_id: string
  slug: string
  name: string
  category: string
  short_description: string
  skill_status: SkillStatus
  required_plan: SkillPlan
  saved_at: string
  last_used_at?: string | null
  enabled: boolean
}

// MySkill mirrors the DR-54 `GET /api/v1/marketplace/my-skills` response item
// (internal/skill/handler/skills.go): the live payload carries `skill_id` (not
// `id`) and no `category`. `id`/`category`/`status` are kept optional only for
// forward-compat and normalization — the live API does not send them — so this
// is a standalone interface, not an extension of the (id/category-required)
// MarketplaceSkill listing type.
export interface MySkill {
  skill_id?: string
  id?: string
  slug: string
  name: string
  category?: string
  skill_status?: SkillStatus
  status?: SkillStatus
  required_plan: SkillPlan
  enabled?: boolean
  enabled_at?: string | null
  last_used_at?: string | null
  availability?: SkillAvailability
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
