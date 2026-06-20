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
export interface GenerationDebugMessage {
  role: string
  content: string
  estimated_tokens: number
  cached: boolean
  index: number
}

export type CacheStatus = 'hit' | 'partial' | 'miss' | 'write' | 'unknown'
export type DebugConfidence = 'exact' | 'inferred' | 'estimated'

export interface GenerationDebugPromptUnit {
  index: number
  message_index: number
  path: string
  role?: string
  kind: string
  content_preview?: string
  estimated_tokens: number
  cumulative_start: number
  cumulative_end: number
  cache_overlap_tokens: number
  cache_status: CacheStatus
  token_source: string
  cache_source: string
  confidence: DebugConfidence
}

export interface GenerationDebugTokenAccounting {
  prompt_tokens: number
  cached_tokens: number
  cache_write_tokens: number
  completion_tokens: number
  source: string
  confidence: DebugConfidence
  cache_write_source?: string
  cache_write_confidence?: DebugConfidence
}

export interface GenerationDebugCacheBoundary {
  cached_tokens: number
  prompt_tokens: number
  cache_hit_rate: number
  estimated_cached_tokens: number
  break_unit_index: number
  break_unit_path?: string
  break_unit_role?: string
  break_offset_tokens: number
  source: string
  confidence: DebugConfidence
}

export interface PromptDebugData {
  messages?: GenerationDebugMessage[]
  upstream_messages?: GenerationDebugMessage[]
  units?: GenerationDebugPromptUnit[]
  upstream_units?: GenerationDebugPromptUnit[]
  instructions?: unknown
  upstream_instructions?: unknown
  tools?: unknown
  upstream_tools?: unknown
  role_counts?: Record<string, number>
  upstream_role_counts?: Record<string, number>
  total_estimated_tokens: number
  upstream_total_estimated_tokens: number
  token_accounting?: GenerationDebugTokenAccounting
  cache_boundary?: GenerationDebugCacheBoundary
  estimated: boolean
}

export interface CompletionDebugData {
  normalized_output?: string
  reasoning_output?: string
  finish_reason?: string
  generation_id?: string
  truncated: boolean
}

export interface GenerationCacheStats {
  cached_tokens: number
  cache_write_tokens: number
  cache_hit_rate: number
}

export interface GenerationDebugSummary {
  prompt?: PromptDebugData
  completion?: CompletionDebugData
  cache: GenerationCacheStats
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  provider_latency_ms: number
  throughput_tokens_per_second: number
  cost?: unknown
  provider_cost?: unknown
  charged_cost: number
  finish_reason?: string
  streaming: boolean
  request_id?: string
  upstream_request_id?: string
  generation_id?: string
}

export interface GenerationDebugRawValue {
  value: unknown
  truncated: boolean
  captured_bytes: number
}

export interface GenerationDebugRaw {
  inbound_request?: GenerationDebugRawValue
  upstream_request?: GenerationDebugRawValue
  raw_response?: GenerationDebugRawValue
  raw_stream?: GenerationDebugRawValue
}
