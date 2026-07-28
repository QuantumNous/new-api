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
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { SavingsTrend } from '../../types.ts'
import {
  buildSavingsTrendChartData,
  calculateSavingsRate,
  normalizeSavingsTrendGranularity,
} from '../savings-chart.ts'

const trend: SavingsTrend = {
  granularity: 'day',
  utc_offset_minutes: 480,
  start_timestamp: 1_785_081_600,
  end_timestamp: 1_785_168_000,
  summary: {
    enabled: true,
    savings_quota: 60,
    official_quota: 150,
    actual_quota: 120,
    request_count: 2,
    estimated_request_count: 2,
    snapshot_request_count: 1,
    reconstructed_request_count: 1,
    coverage_ratio: 1,
    source: 'mixed',
    official_confirmed: true,
    source_updated_at: 0,
    rebuild_price_snapshot_at: 1_785_168_000,
    official_price_stale: false,
    is_partial: false,
    window_days: 1,
  },
  buckets: [
    {
      start_timestamp: 1_785_081_600,
      end_timestamp: 1_785_168_000,
      official_quota: 150,
      actual_quota: 120,
      savings_quota: 60,
      request_count: 2,
      estimated_request_count: 2,
      snapshot_request_count: 1,
      reconstructed_request_count: 1,
      coverage_ratio: 1,
    },
    {
      start_timestamp: 1_785_168_000,
      end_timestamp: 1_785_254_400,
      official_quota: 0,
      actual_quota: 0,
      savings_quota: 0,
      request_count: 0,
      estimated_request_count: 0,
      snapshot_request_count: 0,
      reconstructed_request_count: 0,
      coverage_ratio: 0,
    },
    {
      start_timestamp: 1_785_254_400,
      end_timestamp: 1_785_340_800,
      official_quota: 80,
      actual_quota: 50,
      savings_quota: 30,
      request_count: 1,
      estimated_request_count: 1,
      snapshot_request_count: 1,
      reconstructed_request_count: 0,
      coverage_ratio: 1,
    },
  ],
}

describe('savings trend chart data', () => {
  it('uses the server savings value instead of subtracting aggregate lines', () => {
    const points = buildSavingsTrendChartData(trend, 500_000, 7.3)

    assert.ok(Math.abs(Number(points[0].Official) - 0.00219) < 1e-12)
    assert.ok(Math.abs(Number(points[0].Actual) - 0.001752) < 1e-12)
    assert.ok(Math.abs(Number(points[0].Savings) - 0.000876) < 1e-12)
    assert.notEqual(
      Number(points[0].Official) - Number(points[0].Actual),
      points[0].Savings
    )
  })

  it('maps empty buckets to null so lines do not bridge missing periods', () => {
    const points = buildSavingsTrendChartData(trend, 500_000, 7.3)

    assert.equal(points[0].LineSegment, 'segment-1')
    assert.equal(points[1].Official, null)
    assert.equal(points[1].Actual, null)
    assert.equal(points[1].Savings, null)
    assert.equal(points[1].LineSegment, null)
    assert.equal(points[2].LineSegment, 'segment-2')
  })

  it('does not render uncovered requests as zero-cost estimates', () => {
    const uncoveredTrend: SavingsTrend = {
      ...trend,
      buckets: [
        {
          ...trend.buckets[0],
          official_quota: 0,
          actual_quota: 0,
          savings_quota: 0,
          request_count: 4,
          estimated_request_count: 0,
          snapshot_request_count: 0,
          reconstructed_request_count: 0,
          coverage_ratio: 0,
        },
      ],
    }

    const [point] = buildSavingsTrendChartData(uncoveredTrend, 500_000, 7.3)

    assert.equal(point.Official, null)
    assert.equal(point.Actual, null)
    assert.equal(point.Savings, null)
    assert.equal(point.LineSegment, null)
  })

  it('normalizes weekly dashboard filters to daily savings buckets', () => {
    assert.equal(normalizeSavingsTrendGranularity('week'), 'day')
    assert.equal(normalizeSavingsTrendGranularity('hour'), 'hour')
    assert.equal(normalizeSavingsTrendGranularity('hour', 7 * 24 * 3600), 'day')
  })

  it('calculates savings rate against official quota', () => {
    assert.equal(calculateSavingsRate(trend.summary), 0.4)
  })
})
