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
// Team Schema & Types
// ============================================================================

export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  owner_id: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type Team = z.infer<typeof teamSchema>

export interface TeamMember {
  id: number
  team_id: number
  user_id: number
  role: string // admin | member
  created_at: number
}

export interface TeamProject {
  id: number
  team_id: number
  name: string
  description: string
  created_at: number
  updated_at: number
}

export interface TeamBilling {
  team_id: number
  member_count: number
  allocated: number // 成员额度总和
  used: number // 成员已用额度总和
  usage_quota: number // 团队实际消耗配额（按 team_id 聚合消耗日志）
  prompt_tokens: number // 团队实际 prompt tokens
  completion_tokens: number // 团队实际 completion tokens
  request_count: number // 团队实际请求数
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ListTeamsParams {
  page?: number
  page_size?: number
  keyword?: string
}

export interface TeamFormData {
  name: string
  description: string
  owner_id: number
}

// Update payload: the backend only persists description and owner_id.
export interface TeamUpdateData {
  description: string
  owner_id: number
}

export interface TeamMemberFormData {
  user_id: number
  role: string
}

export interface TeamProjectFormData {
  name: string
  description: string
}

export type TeamsDialogType = 'create' | 'update' | 'delete'
