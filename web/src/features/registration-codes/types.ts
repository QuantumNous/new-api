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
// RegistrationCode Schema & Types
// ============================================================================

export const registrationCodeSchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  status: z.number(), // 1: unused, 3: used
  created_time: z.number(),
  used_time: z.number(),
  expired_time: z.number(), // 0 for never expires
  used_user_id: z.number(),
  used_username: z.string().optional(), // server may send an empty string
})

export type RegistrationCode = z.infer<typeof registrationCodeSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetRegistrationCodesParams {
  p?: number
  page_size?: number
}

export interface GetRegistrationCodesResponse {
  success: boolean
  message?: string
  data?: {
    items: RegistrationCode[]
    total: number
    page: number
    page_size: number
  }
}

export interface SearchRegistrationCodesParams {
  keyword?: string
  status?: string
  p?: number
  page_size?: number
}

export interface RegistrationCodeFormData {
  id?: number
  name: string
  expired_time: number
  count?: number // Only for create
}

// ============================================================================
// Dialog Types
// ============================================================================

export type RegistrationCodesDialogType =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
