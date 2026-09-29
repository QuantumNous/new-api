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
import { describe, expect, it } from 'vitest'

import type { CacheRateChartRow } from '../types'
import { processCacheRateChartData } from './charts'

const hour = 3600
const base = 1767225600

function row(
  series: string,
  createdAt: number,
  prompt: number,
  cacheRead: number,
  cacheWrite: number
): CacheRateChartRow {
  return {
    series,
    created_at: createdAt,
    prompt_tokens: prompt,
    cache_tokens: cacheRead,
    cache_creation_tokens: cacheWrite,
  }
}

describe('processCacheRateChartData', () => {
  it('returns an empty no-data spec when rows are empty', () => {
    const spec = processCacheRateChartData([], {
      metric: 'read',
      timeGranularity: 'hour',
    })
    expect(spec.type).toBe('line')
    expect(spec.data[0].values).toEqual([])
    expect(spec.title?.text).toBe('Cache Read Rate')
    expect(spec.title?.subtext).toBe('No data available')
  })

  it('computes per-bucket rates from summed prompt and cache columns', () => {
    const spec = processCacheRateChartData(
      [
        row('m1', base, 10, 5, 0),
        row('m1', base + 60, 30, 10, 0),
        row('m1', base + hour, 40, 20, 0),
      ],
      { metric: 'read', timeGranularity: 'hour' }
    )
    const values = spec.data[0].values as Array<{
      Time: string
      Series: string
      Rate: number
    }>
    expect(values).toHaveLength(2)
    const first = values.find((v) => v.Rate === 37.5)
    expect(first?.Series).toBe('m1')
    expect(values.some((v) => v.Rate === 50)).toBe(true)
  })

  it('clamps rates above 100 percent to 100', () => {
    const spec = processCacheRateChartData(
      [row('m1', base, 100, 150, 0)],
      { metric: 'read', timeGranularity: 'hour' }
    )
    const values = spec.data[0].values as Array<{ Rate: number }>
    expect(values).toHaveLength(1)
    expect(values[0].Rate).toBe(100)
  })

  it('keeps only the top series ranked by prompt volume', () => {
    const rows: CacheRateChartRow[] = []
    for (let i = 0; i < 11; i++) {
      rows.push(row(`s${i}`, base, 100 - i * 8, 10, 0))
    }
    const spec = processCacheRateChartData(rows, {
      metric: 'read',
      timeGranularity: 'hour',
    })
    const values = spec.data[0].values as Array<{ Series: string }>
    // All 11 series have prompt tokens and computable rates, so only the
    // prompt-volume ranking decides: s0–s9 stay within the top-10 limit and
    // s10 (smallest prompt volume) is the only series cut off.
    const series = new Set(values.map((v) => v.Series))
    expect(series.size).toBe(10)
    expect(series.has('s9')).toBe(true)
    expect(series.has('s10')).toBe(false)
  })

  it('switches the numerator by metric', () => {
    const rows = [row('m1', base, 100, 50, 25)]
    const readSpec = processCacheRateChartData(rows, {
      metric: 'read',
      timeGranularity: 'hour',
    })
    const creationSpec = processCacheRateChartData(rows, {
      metric: 'creation',
      timeGranularity: 'hour',
    })
    expect(
      (readSpec.data[0].values as Array<{ Rate: number }>)[0].Rate
    ).toBe(50)
    expect(
      (creationSpec.data[0].values as Array<{ Rate: number }>)[0].Rate
    ).toBe(25)
  })

  it('skips buckets without prompt tokens', () => {
    const spec = processCacheRateChartData(
      [row('m1', base, 0, 50, 0)],
      { metric: 'read', timeGranularity: 'hour' }
    )
    expect(spec.data[0].values).toEqual([])
    expect(spec.title?.subtext).toBe('No data available')
  })

  it('carries all-series totals in the tooltip fields even beyond the top series', () => {
    // 11 prompt-bearing series in one bucket: s10 falls outside the top-10
    // series but its tokens must still count in the per-time totals the
    // tooltip "Total" row divides, matching the stat cards' whole-range rate.
    const rows: CacheRateChartRow[] = []
    for (let i = 0; i < 11; i++) {
      rows.push(row(`s${i}`, base, 100 - i * 8, 10, 0))
    }
    const spec = processCacheRateChartData(rows, {
      metric: 'read',
      timeGranularity: 'hour',
    })
    const values = spec.data[0].values as Array<{
      Series: string
      TimePrompt: number
      TimeCache: number
    }>
    const s0 = values.find((v) => v.Series === 's0')
    const totalPrompt = 11 * 100 - 8 * 55 // 660, includes the dropped s10
    expect(s0?.TimePrompt).toBe(totalPrompt)
    expect(s0?.TimeCache).toBe(110)
  })
})
