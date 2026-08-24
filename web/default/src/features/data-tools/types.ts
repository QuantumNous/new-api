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
export type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type DataToolPricing = {
  model: 'per_call' | 'per_result' | 'per_second' | 'provider_tokens' | 'free'
  amount: number
  base: number
  payOnMatch: boolean
  currency: string
  unit?: string
  label?: string
  quantityField?: string
  multiplierField?: string
}

export type DataToolSummary = {
  id: string
  name: string
  provider: string
  platform: string
  categories: string[]
  description: string
  pricing: DataToolPricing
  quarantined: string | null
  isNew: boolean
  flatkey_price_usd: number
}

export type DataToolPlatform = {
  platform: string
  count: number
  isNew: boolean
}

export type DataToolList = {
  total: number
  matched: number
  page: number
  pageSize: number
  nextCursor: string | null
  tools: DataToolSummary[]
  platforms: DataToolPlatform[]
}

export type DataToolFieldSchema = {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: Array<string | number | boolean>
  default?: unknown
  example?: unknown
  items?: { type?: string }
}

export type DataToolInputSchema = {
  type: 'object'
  properties: Record<string, DataToolFieldSchema>
  required?: string[]
}

export type DataToolInspection = {
  id: string
  name: string
  provider: string
  description: string
  input: DataToolInputSchema
  pricing: DataToolPricing
  quarantined: string | null
  flatkey_price_usd: number
}

export type DataToolRunResult = {
  tool: string
  output: unknown
  resultCount: number
  charged_quota: number
  charged_usd: number
  remaining_quota: number
  replayed: boolean
  latencyMs: number
}

export type DataToolListParams = {
  q?: string
  platform?: string
  page?: number
  page_size?: number
  cursor?: string
}
