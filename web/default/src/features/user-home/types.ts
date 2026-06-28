/*
Copyright (C) 2026 DeepRouter
SPDX-License-Identifier: AGPL-3.0-or-later
*/
import type {
  MarketplaceSkill,
  SavedSkill,
  SkillGrowthEntryPoint,
} from '@/features/marketplace/types'

export interface UserHomeAccountStatus {
  balance_quota: number
  balance_usd: number
  display_balance: number
  display_unit: string
  used_quota: number
  recent_topups_count: number
  recent_topups_total: number
  last_topup_at?: number | null
}

export interface UserHomeSubscriptionPlan {
  id: number
  title: string
  price_amount: number
  currency: string
  duration_unit: string
  duration_value: number
}

export interface UserHomeSubscription {
  id: number
  user_id: number
  plan_id: number
  amount_total: number
  amount_used: number
  start_time: number
  end_time: number
  status: string
}

export interface UserHomeSubscriptionSummary {
  subscription: UserHomeSubscription
  plan?: UserHomeSubscriptionPlan | null
}

export interface UserHomeSubscriptionInfo {
  billing_preference: string
  active: UserHomeSubscriptionSummary[]
  all: UserHomeSubscriptionSummary[]
}

export interface UserHomePurchaseOrder {
  order_id: string
  skill_id: string
  skill_slug: string
  skill_name: string
  status: string
  amount_usd: number
  currency: string
  quota_charged: number
  monetization_type: string
  created_at: string
  completed_at?: string | null
  entitled: boolean
}

export interface UserHomePurchaseInfo {
  entitled_skill_ids: string[]
  recent_orders: UserHomePurchaseOrder[]
  succeeded_count: number
}

export interface UserHomeData {
  account: UserHomeAccountStatus
  subscriptions: UserHomeSubscriptionInfo
  purchases: UserHomePurchaseInfo
  saved_skills: SavedSkill[]
  recommended_for_you: MarketplaceSkill[]
  new_this_week_for_you: MarketplaceSkill[]
  recommended_categories: string[]
  entry_point: SkillGrowthEntryPoint
}
