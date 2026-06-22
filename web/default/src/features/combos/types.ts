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
// Combo Schema & Types
// ============================================================================

export const comboSchema = z.object({
  id: z.number(),
  name: z.string(),
  user_id: z.number(),
  models: z.string().nullable(), // CSV string before parse
  strategy: z.string(),
  weights: z.string().nullable(),
  status: z.number(),
  created_time: z.number().nullable(),
})

export type Combo = z.infer<typeof comboSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

export interface GetCombosParams {
  page?: number
  page_size?: number
  keyword?: string
}

export interface GetCombosResponse {
  items: Combo[]
  total: number
  page: number
  page_size: number
}

export interface ComboFormData {
  name: string
  models: string
  strategy: 'fallback' | 'random' | 'weighted' | 'round_robin'
  weights?: string
  status: number
}

// ============================================================================
// Combo Form Schema & Types
// ============================================================================

export const comboFormSchema = z.object({
  name: z.string().min(1),
  models: z.string().min(1),
  strategy: z.enum(['fallback', 'random', 'weighted', 'round_robin']),
  weights: z.string().optional(),
  status: z.number().int().min(0).max(1),
})

export type ComboFormValues = z.infer<typeof comboFormSchema>

export type ComboDialogType = 'create' | 'update' | 'delete' | 'batch-delete'
