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
import type { ModelAvailabilityStatus } from '@/lib/model-availability'

export type ModelAccessScopeMode = 'selectable_group' | 'fixed_account'

export type ModelAccessVendor = {
  id: number
  name: string
  icon?: string
}

export type ModelAccessModel = {
  id: string
  allowlist_match_key: string
  vendor: ModelAccessVendor | null
  supported_endpoint_types: string[]
  availability_status: ModelAvailabilityStatus | 'unknown'
}

export type ModelAccessScope = {
  id: string
  label: string
  description?: string
  ratio: number | null
  model_ids: string[]
  model_ratios: Record<string, number>
}

export type ModelRatioContext = {
  defaultRatio: number | null
  modelRatios: Readonly<Record<string, number>>
}

export type UserModelAccess = {
  scope_mode: ModelAccessScopeMode
  identity_scope: string | null
  identity_model_ids: string[]
  identity_model_ratios: Record<string, number>
  identity_default_ratio: number | null
  create_default_scope: string | null
  groups: ModelAccessScope[]
  account_model_ids: string[]
  account_model_ratios: Record<string, number>
  account_default_ratio: number | null
  models: ModelAccessModel[]
}

export type UserModelAccessResponse = {
  success: boolean
  message?: string
  data?: UserModelAccess
}

export type TokenModelAccessConfig = {
  group?: string | null
  model_limits_enabled: boolean
  model_limits: string | string[] | null | undefined
}
