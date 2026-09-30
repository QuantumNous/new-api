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
import type { ModelCacheStatsBucket } from '../api'

/** Cache rate metrics share one model-square trend chart. */
export type ModelCacheRateMetric = 'read' | 'creation' | 'hit'

export interface ModelCacheRateMetricOption {
  key: ModelCacheRateMetric
  label: string
}

/** One rendered chart point: an hourly rate of one metric line. */
export interface ModelCacheRatePoint {
  time: string
  series: string
  rate: number
}

export interface ModelCacheBucketTotals {
  count: number
  prompt_tokens: number
  cache_tokens: number
  cache_creation_tokens: number
  cache_hit_count: number
}

// Hours without usage produce no point, so the line breaks there and the
// band axis only shows hours the model actually served — same as the
// dashboard cache-rate chart.

function hourLabel(timestampSec: number): string {
  const date = new Date(timestampSec * 1000)
  return `${String(date.getHours()).padStart(2, '0')}:00`
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Sum a metric's per-bucket buckets into whole-window totals. */
export function sumCacheBuckets(
  buckets: ModelCacheStatsBucket[]
): ModelCacheBucketTotals {
  const totals: ModelCacheBucketTotals = {
    count: 0,
    prompt_tokens: 0,
    cache_tokens: 0,
    cache_creation_tokens: 0,
    cache_hit_count: 0,
  }
  for (const bucket of buckets) {
    totals.count += Number(bucket.count) || 0
    totals.prompt_tokens += Number(bucket.prompt_tokens) || 0
    totals.cache_tokens += Number(bucket.cache_tokens) || 0
    totals.cache_creation_tokens += Number(bucket.cache_creation_tokens) || 0
    totals.cache_hit_count += Number(bucket.cache_hit_count) || 0
  }
  return totals
}

/**
 * Turn hourly usage buckets into trend-chart points, one point per metric
 * that has a computable rate in that hour. Token-based rates divide cached
 * tokens by input tokens; the hit rate divides cache-hit requests by total
 * requests. Hours without usage yield no point (the line breaks there), and
 * rates clamp at 100% because OpenAI cache-write counts and OpenRouter-Claude
 * prompt bases can push the naive ratio above 1.
 */
export function buildModelCacheRateChartData(
  buckets: ModelCacheStatsBucket[],
  metrics: ModelCacheRateMetricOption[]
): ModelCacheRatePoint[] {
  if (buckets.length === 0 || metrics.length === 0) return []

  const bucketByHour = new Map<number, ModelCacheStatsBucket>()
  for (const bucket of buckets) {
    const timestamp = Number(bucket.created_at) || 0
    if (timestamp > 0) bucketByHour.set(timestamp, bucket)
  }
  if (bucketByHour.size === 0) return []

  const values: ModelCacheRatePoint[] = []
  for (const [timestamp, bucket] of [...bucketByHour].sort((a, b) => a[0] - b[0])) {
    const promptTokens = Number(bucket.prompt_tokens) || 0
    const count = Number(bucket.count) || 0
    for (const metric of metrics) {
      if (metric.key === 'hit') {
        if (count <= 0) continue
        values.push({
          time: hourLabel(timestamp),
          series: metric.label,
          rate: round1(
            Math.min((Number(bucket.cache_hit_count) || 0) / count, 1) * 100
          ),
        })
        continue
      }
      if (promptTokens <= 0) continue
      const numerator =
        metric.key === 'read'
          ? Number(bucket.cache_tokens) || 0
          : Number(bucket.cache_creation_tokens) || 0
      values.push({
        time: hourLabel(timestamp),
        series: metric.label,
        rate: round1(Math.min(numerator / promptTokens, 1) * 100),
      })
    }
  }
  return values
}
