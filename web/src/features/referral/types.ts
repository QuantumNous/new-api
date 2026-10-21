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
export type CommissionStats = {
  aff_code: string
  commission_balance_cents: number
  commission_pending_cents: number
  commission_lifetime_cents: number
  commission_redeemed_cents: number
}

export type CommissionRecord = {
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

export type CommissionRedemption = {
  id: number
  user_id: number
  commission_cents: number
  usd_exchange_rate: number
  quota_per_unit: number
  quota_credited: number
  created_at: number
}

export type CommissionDownline = {
  user_id: number
  created_at: number
  username: string
  email: string
}

export type CommissionQuotaPreview = {
  quota_credited: number
  usd_exchange_rate: number
  quota_per_unit: number
}
