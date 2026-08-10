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
// SLA Incident Schema & Types
// ============================================================================

export const slaIncidentSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  status: z.number(), // 1 investigating, 2 identified, 3 monitoring, 4 resolved
  severity: z.string(), // minor | major | critical
  started_at: z.number(),
  resolved_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type SlaIncident = z.infer<typeof slaIncidentSchema>

// Public status summary (GET /api/sla/status)
export interface SlaNodeStatus {
  id: number
  name: string
  status: number
  response_time: number
}

export interface SlaStatusSummary {
  availability: number // 0..1
  window_hours: number
  node_count: number
  ok_node_count: number
  active_incidents: number
  nodes: SlaNodeStatus[]
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ListSlaIncidentsParams {
  page?: number
  page_size?: number
  status?: string // exact status as string
}

export interface ListSlaIncidentsResponse {
  success: boolean
  message?: string
  data?: {
    items: SlaIncident[]
    total: number
  }
}

export interface PublicSlaIncidentsResponse {
  success: boolean
  message?: string
  data?: {
    items: SlaIncident[]
  }
}

export interface PublicSlaStatusResponse {
  success: boolean
  message?: string
  data?: SlaStatusSummary
}

export interface SlaIncidentFormData {
  title: string
  description: string
  status: number
  severity: string
  started_at: number
  resolved_at: number
}

export type SlaIncidentsDialogType = 'create' | 'update' | 'delete'
