/*
Copyright (C) 2023-2026 QuantumNous
...
*/
export type CommissionRule = {
  id: number
  scope: string
  level: number
  rate_percent: number
  min_topup_cents: number
  frozen_days: number
  enabled: boolean
  created_at: number
  updated_at: number
}

export type AdminCommissionRecord = {
  id: number
  beneficiary_id: number
  source_user_id: number
  source_topup_id: number
  scope: string
  level: number
  rate_percent: number
  base_amount_cents: number
  commission_amount_cents: number
  status: 'pending' | 'settled' | 'voided'
  frozen_until: number
  settled_at: number
  voided_at: number
  voided_reason: string
  created_at: number
}

export type CommissionOverview = {
  total_cents: number
  settled_cents: number
  pending_cents: number
  redeemed_cents: number
  participants_count: number
  first_topup_count: number
}
