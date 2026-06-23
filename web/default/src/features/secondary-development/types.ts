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
export type ApiResponse<T> = {
  success: boolean
  message?: string
  data?: T
}

export type PageData<T> = {
  page: number
  page_size: number
  total: number
  items: T[]
}

export type Role = {
  id: number
  code: string
  name: string
  description?: string
  builtin: boolean
  permissions?: string[]
}

export type Permission = {
  id: number
  code: string
  name: string
  description?: string
}

export type UserRole = {
  id: number
  user_id: number
  role_code: string
}

export type ProviderProfile = {
  id: number
  user_id: number
  name: string
  description?: string
  contact?: string
  status: string
  created_at?: number
  updated_at?: number
}

export type ProviderWallet = {
  id: number
  provider_id: number
  currency: string
  balance: number
  available_balance: number
  frozen_balance: number
  wallet_address?: string
  wallet_address_mask?: string
}

export type ProviderSettlementConfig = {
  id: number
  provider_id: number
  currency: string
  usdt_rate: number
  commission_ratio: number
  min_withdrawal: number
  withdrawal_fee: number
  daily_withdrawal_max: number
}

export type MarketplaceModel = {
  id: number
  provider_id: number
  name: string
  description?: string
  model_type?: string
  tags?: string
  context_length: number
  billing_type?: string
  status: string
  recommended: boolean
  sort_order: number
  provider?: ProviderProfile
}

export type ModelApiConfig = {
  id: number
  model_id: number
  base_url: string
  protocol: string
  auth_type: string
  model_mapping?: string
  request_format?: string
  response_format?: string
  status: string
}

export type ModelKey = {
  id: number
  model_id: number
  name: string
  key_mask: string
  status: string
  last_checked_at?: number
}

export type ModelPricing = {
  id: number
  model_id: number
  input_price: number
  output_price: number
  call_price: number
  currency: string
  pricing_type: string
  status: string
}

export type ModelReviewRecord = {
  id: number
  model_id: number
  reviewer_id: number
  action: string
  comment?: string
  created_at: number
}

export type MarketplaceModelDetail = MarketplaceModel & {
  api_configs: ModelApiConfig[]
  keys: ModelKey[]
  pricing: ModelPricing[]
  reviews: ModelReviewRecord[]
  wallet?: ProviderWallet
  settlement?: ProviderSettlementConfig
}
