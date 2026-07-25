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

/**
 * Compute (GPU rental) admin types.
 *
 * WHITELABEL: the backend never serializes the underlying marketplace
 * provider (contract id / host ip / provider name), so these client types
 * intentionally contain only flatkey-branded, provider-agnostic fields.
 */

export type ComputeNodeStatus =
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'error'

export interface ComputeNode {
  id: number
  label: string
  gpu_name: string
  cost_per_hour: number
  model_served: string
  status: ComputeNodeStatus
  channel_id: number
  created_time: number
}

export interface ComputeStats {
  total: number
  running: number
  est_cost_per_day: number
}

export interface ComputeNodesResult {
  items: ComputeNode[]
  total: number
  page: number
  page_size: number
  stats: ComputeStats
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}
