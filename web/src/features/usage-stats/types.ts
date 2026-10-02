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
 * One aggregated row of the usage-stats page, grouped either by model or by
 * channel (see the backend's `GET /api/log/usage_stat`).
 *
 * Token semantics differ per upstream, so the server normalizes them:
 * `input_tokens` is the total input including cache hits, `miss_tokens` is the
 * part that missed the cache, and `cache_hit_rate = cache_tokens / input_tokens`.
 * Never rebuild the total as prompt + cache + cache_creation — for OpenAI-style
 * upstreams (DeepSeek included) `prompt_tokens` already contains the cache hits.
 */
export type UsageStatItem = {
  model_name?: string
  channel_id?: number
  /** Resolved server-side; falls back to `channel-<id>` for deleted channels. */
  channel_name?: string
  count: number
  prompt_tokens: number
  cache_tokens: number
  /** Normalized cache-write total (5m/1h split summed when present). */
  cache_creation_tokens: number
  completion_tokens: number
  /** Total input, cache hits included. */
  input_tokens: number
  /** Input that missed the cache. */
  miss_tokens: number
  quota: number
  /** Ratio in the 0..1 range. */
  cache_hit_rate: number
}

export type UsageStatResult = {
  by_model: UsageStatItem[]
  by_channel: UsageStatItem[]
  totals: UsageStatItem
}

export type UsageStatDimension = 'model' | 'channel'
