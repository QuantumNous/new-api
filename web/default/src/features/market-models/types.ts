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
import { z } from 'zod'

// ============================================================================
// Market Model Schema & Types
// ============================================================================

export const marketModelSchema = z.object({
  id: z.number(),
  model: z.string(),
  provider: z.string(),
  category: z.string(),
  tags: z.string(),
  input_price: z.number(),
  output_price: z.number(),
  currency: z.string(),
  unit: z.string(),
  metadata: z.string(),
  trial_quota: z.number(),
  status: z.number(), // 1: available, 2: coming_soon, 3: disabled
  featured: z.boolean(),
  sort: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type MarketModel = z.infer<typeof marketModelSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetMarketModelsParams {
  p?: number
  page_size?: number
  status?: string
  category?: string
}

export interface GetMarketModelsResponse {
  success: boolean
  message?: string
  data?: {
    items: MarketModel[]
    total: number
    page: number
    page_size: number
  }
}

export interface MarketModelFormData {
  model: string
  provider: string
  category: string
  tags: string
  input_price: number
  output_price: number
  currency: string
  unit: string
  metadata: string
  trial_quota: number
  status: number
  featured: boolean
  sort: number
}

// ============================================================================
// Dialog Types
// ============================================================================

export type MarketModelsDialogType = 'create' | 'update' | 'delete'
