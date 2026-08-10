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
// Region Route Schema & Types
// ============================================================================

export const regionRouteSchema = z.object({
  id: z.number(),
  region: z.string(),
  model: z.string(),
  channel_ids: z.string(), // comma-separated channel id list
  tag: z.string(),
  strategy: z.string(),
  priority: z.number(),
  weight: z.number(),
  enabled: z.boolean(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type RegionRoute = z.infer<typeof regionRouteSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ListRegionRoutesParams {
  page?: number
  page_size?: number
  region?: string
  model?: string
}

export interface ListRegionRoutesResponse {
  success: boolean
  message?: string
  data?: {
    items: RegionRoute[]
    total: number
  }
}

// Payload mirrors the Go anonymous request struct (channel_ids is a comma string).
export interface RegionRouteFormData {
  region: string
  model: string
  channel_ids: string
  tag: string
  strategy: string
  priority: number
  weight: number
  enabled: boolean
}

// ============================================================================
// Dialog Types
// ============================================================================

export type RegionRoutesDialogType = 'create' | 'update' | 'delete'
