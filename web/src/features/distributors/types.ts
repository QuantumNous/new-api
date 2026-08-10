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
*/
import { z } from 'zod'

// ============================================================================
// Distributor Schema & Types
// ============================================================================

export const distributorSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  tier: z.string(), // standard | gold | platinum
  commission_rate: z.number(), // percent
  status: z.number(), // 1 active, 2 disabled
  created_at: z.number(),
  updated_at: z.number(),
})

export type Distributor = z.infer<typeof distributorSchema>

export const distributorPriceSchema = z.object({
  id: z.number(),
  distributor_id: z.number(),
  model: z.string(),
  input_price: z.number(),
  output_price: z.number(),
  currency: z.string(), // CNY | USD
  unit: z.string(), // token | image | second | char
  created_at: z.number(),
  updated_at: z.number(),
})

export type DistributorPrice = z.infer<typeof distributorPriceSchema>

export interface DistributorSubUser {
  id: number
  username: string
  email: string
  quota: number
  used_quota: number
  status: number
  group: string
  created_at: number
  inviter_id: number
  team_id: number
}

export interface DistributorBilling {
  distributor_id: number
  sub_user_count: number
  allocated: number
  used: number
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ListDistributorsParams {
  page?: number
  page_size?: number
  keyword?: string
}

export interface DistributorFormData {
  user_id: number
  name: string
  tier: string
  commission_rate: number
  status: number
}

export interface DistributorUpdateData {
  name: string
  tier: string
  commission_rate: number
  status: number
}

export interface DistributorPriceFormData {
  model: string
  input_price: number
  output_price: number
  currency: string
  unit: string
}

export type DistributorsDialogType = 'create' | 'update' | 'delete'

export type DistributorPricesDialogType = 'create' | 'update' | 'delete'
