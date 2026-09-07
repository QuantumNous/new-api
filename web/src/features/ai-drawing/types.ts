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
export type ImageSize =
  | '1024x1024'
  | '864x1152'
  | '1536x864'
  | '1152x864'
  | '864x1536'
  | '1024x1536'
  | '1536x1024'
  | '1792x768'
export type DrawingPlanItem = { id?: string; title: string; prompt: string }
export type DrawingRequest = {
  expectedAgentPriceVersion?: number
  model: string
  group: string
  prompt: string
  size: ImageSize
  count?: number
  image?: File
  items?: DrawingPlanItem[]
}
export type DrawingItem = DrawingPlanItem & {
  id: string
  batch_id: string
  position: number
  status:
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'unknown'
    | 'storage_failed'
    | 'recovering'
    | 'expired'
  attempts: number
  request_id: string
  error: string
  mime: string
  width: number
  height: number
  expires_at: number
}
export type DrawingBatch = {
  id: string
  model: string
  group: string
  ratio: string
  created_at: number
  expires_at: number
  items: DrawingItem[]
}
export type DrawingSettings = {
  max_count: number
  lifetime_seconds: number
}

export type DrawingTemplate = {
  id: string
  name: string
  prompt: string
  updated_at: number
}
