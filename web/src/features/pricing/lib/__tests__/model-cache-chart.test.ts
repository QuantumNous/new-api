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
import { describe, expect, test } from 'vitest'

import type { ModelCacheStatsBucket } from '../../api'
import {
  buildModelCacheRateChartData,
  sumCacheBuckets,
} from '../model-cache-chart'

// Fixed full-hour timestamps far from "now" so nothing else interferes.
const HOUR_A = 1893528000
const HOUR_B = HOUR_A + 3600

function bucket(overrides: Partial<ModelCacheStatsBucket>): ModelCacheStatsBucket {
  return {
    created_at: HOUR_A,
    count: 0,
    prompt_tokens: 0,
    cache_tokens: 0,
    cache_creation_tokens: 0,
    cache_hit_count: 0,
    ...overrides,
  }
}

const ALL_METRICS = [
  { key: 'read' as const, label: 'Cache Read Rate' },
  { key: 'creation' as const, label: 'Cache Creation Rate' },
  { key: 'hit' as const, label: 'Cache Hit Rate' },
]

describe('sumCacheBuckets', () => {
  test('returns zero totals for an empty series', () => {
    expect(sumCacheBuckets([])).toEqual({
      count: 0,
      prompt_tokens: 0,
      cache_tokens: 0,
      cache_creation_tokens: 0,
      cache_hit_count: 0,
    })
  })

  test('sums every bucket column across the window', () => {
    const totals = sumCacheBuckets([
      bucket({
        count: 2,
        prompt_tokens: 80,
        cache_tokens: 60,
        cache_creation_tokens: 5,
        cache_hit_count: 1,
      }),
      bucket({
        created_at: HOUR_B,
        count: 3,
        prompt_tokens: 40,
        cache_tokens: 0,
        cache_creation_tokens: 4,
        cache_hit_count: 2,
      }),
    ])
    expect(totals).toEqual({
      count: 5,
      prompt_tokens: 120,
      cache_tokens: 60,
      cache_creation_tokens: 9,
      cache_hit_count: 3,
    })
  })
})

describe('buildModelCacheRateChartData', () => {
  test('returns no points for empty buckets or metrics', () => {
    expect(buildModelCacheRateChartData([], ALL_METRICS)).toEqual([])
    expect(
      buildModelCacheRateChartData(
        [bucket({ count: 1, prompt_tokens: 10 })],
        []
      )
    ).toEqual([])
  })

  test('computes hourly rates per metric with one-decimal rounding', () => {
    const points = buildModelCacheRateChartData(
      [
        bucket({
          count: 3,
          prompt_tokens: 300,
          cache_tokens: 91,
          cache_creation_tokens: 5,
          cache_hit_count: 2,
        }),
      ],
      ALL_METRICS
    )
    expect(points).toHaveLength(3)
    const bySeries = new Map(points.map((point) => [point.series, point]))
    expect(bySeries.get('Cache Read Rate')?.rate).toBe(30.3)
    expect(bySeries.get('Cache Creation Rate')?.rate).toBe(1.7)
    expect(bySeries.get('Cache Hit Rate')?.rate).toBe(66.7)
    for (const point of points) {
      expect(point.time).toMatch(/^\d{2}:00$/)
    }
  })

  test('orders points by time and keeps zero-rate points with a denominator', () => {
    const points = buildModelCacheRateChartData(
      [
        // Input is out of order; output must still be time-ascending.
        bucket({
          created_at: HOUR_B,
          count: 4,
          prompt_tokens: 200,
          cache_tokens: 100,
          cache_hit_count: 0,
        }),
        bucket({
          count: 2,
          prompt_tokens: 100,
          cache_tokens: 50,
          cache_hit_count: 2,
        }),
      ],
      ALL_METRICS
    )
    // Every metric has a denominator in both hours: 3 metrics × 2 hours.
    expect(points).toHaveLength(6)
    const firstTime = points.at(0)?.time
    const lastTime = points.at(-1)?.time
    expect(firstTime).toBeDefined()
    expect(lastTime).toBeDefined()
    expect(firstTime).not.toBe(lastTime)
    // The first three points belong to the earlier hour.
    expect(
      points.slice(0, 3).every((point) => point.time === firstTime)
    ).toBe(true)
    // Hour B has requests but zero hits: the hit line still gets a 0% point.
    const hitInLastHour = points.find(
      (point) => point.series === 'Cache Hit Rate' && point.time === lastTime
    )
    expect(hitInLastHour?.rate).toBe(0)
  })

  test('omits a point when the metric denominator is zero', () => {
    const points = buildModelCacheRateChartData(
      [
        // Usage exists but no prompt tokens: only the hit rate is computable.
        bucket({ count: 5, cache_hit_count: 3 }),
        // Requests exist but no hits: only the token-based rates are computable.
        bucket({
          created_at: HOUR_B,
          count: 0,
          prompt_tokens: 100,
          cache_tokens: 25,
        }),
      ],
      ALL_METRICS
    )
    // Points are in time order; within a bucket the metrics keep their order.
    expect(points.map((point) => point.series)).toEqual([
      'Cache Hit Rate',
      'Cache Read Rate',
      'Cache Creation Rate',
    ])
  })

  test('clamps rates above 100% from overlapping cache counts', () => {
    const points = buildModelCacheRateChartData(
      [bucket({ count: 2, prompt_tokens: 100, cache_tokens: 150 })],
      [{ key: 'read', label: 'Cache Read Rate' }]
    )
    expect(points[0]?.rate).toBe(100)
  })

  test('only draws lines for the requested metrics', () => {
    const points = buildModelCacheRateChartData(
      [bucket({ count: 2, prompt_tokens: 100, cache_tokens: 40, cache_hit_count: 1 })],
      [
        { key: 'read', label: 'Cache Read Rate' },
        { key: 'hit', label: 'Cache Hit Rate' },
      ]
    )
    expect(points.map((point) => point.series)).toEqual([
      'Cache Read Rate',
      'Cache Hit Rate',
    ])
  })

  test('ignores buckets with a non-positive timestamp', () => {
    const points = buildModelCacheRateChartData(
      [bucket({ created_at: 0, count: 1, prompt_tokens: 10, cache_tokens: 5 })],
      ALL_METRICS
    )
    expect(points).toEqual([])
  })
})
