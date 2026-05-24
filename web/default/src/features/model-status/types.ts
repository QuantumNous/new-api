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

export type ModelStatusCode = 0 | 1 | 2 | number

export interface ModelStatusTimelinePoint {
  timestamp: number
  status: ModelStatusCode
  availability: number
  latency: number
}

export interface ModelStatusMonitor {
  name: string
  model: string
  uptime: number
  availability: number
  status: ModelStatusCode
  latency: number
  group?: string
  updated_at: number
  history: ModelStatusTimelinePoint[]
}

export interface ModelStatusPayload {
  success: boolean
  message: string
  data: Array<{
    categoryName: string
    monitors: ModelStatusMonitor[]
  }>
}

export interface ModelStatusViewModel {
  name: string
  model: string
  group: string
  status: ModelStatusCode
  uptime: number
  availability: number
  latency: number
  updatedAt: number
  history: ModelStatusTimelinePoint[]
  healthLabel: ModelStatusHealth
}

export interface ModelStatusViewGroup {
  name: string
  totalModels: number
  upModels: number
  degradedModels: number
  downModels: number
  unknownModels: number
  updatedAt: number
  models: ModelStatusViewModel[]
}

export interface ModelStatusViewSummary {
  totalGroups: number
  totalModels: number
  upModels: number
  degradedModels: number
  downModels: number
  unknownModels: number
  updatedAt: number
  overallStatus: ModelStatusHealth
}

export interface ModelStatusView {
  summary: ModelStatusViewSummary
  groups: ModelStatusViewGroup[]
}

export type ModelStatusHealth = 'up' | 'degraded' | 'down' | 'unknown'

export type ModelStatusFilter = 'all' | ModelStatusHealth
