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
import { describe, test } from 'node:test'

import type { AdminPerformanceData } from '../../types'
import {
  buildAdminPerformanceRows,
  getAdminPerformanceDisplayState,
} from '../admin'

const emptyMetrics = {
  request_count: 0,
  success_count: 0,
  failure_count: 0,
  success_rate: null,
  avg_latency_ms: null,
  avg_ttft_ms: null,
  ttft_sample_count: 0,
  output_tokens: 0,
  avg_tps: null,
  active_group_count: 0,
}

const emptyChanges = {
  request_count_pct: null,
  success_rate_pp: null,
  avg_latency_pct: null,
  avg_ttft_pct: null,
  avg_tps_pct: null,
}

function performanceData(): AdminPerformanceData {
  return {
    metrics_enabled: true,
    generated_at: 200,
    bucket_seconds: 3600,
    expected_max_lag_seconds: 300,
    requested_period: { start: 100, end: 200 },
    actual_period: { start: 100, end: 200 },
    previous_period: { start: 0, end: 100 },
    available_range: { oldest_bucket_ts: 0, newest_bucket_ts: 100 },
    has_complete_buckets: true,
    models: [
      {
        model_name: 'gpt-test',
        enabled: true,
        health: 'healthy',
        health_reasons: [],
        metrics: { ...emptyMetrics, request_count: 20 },
        previous_metrics: emptyMetrics,
        changes: emptyChanges,
        groups: [
          {
            group: 'default',
            enabled: false,
            health: 'no_samples',
            health_reasons: ['no_samples'],
            metrics: emptyMetrics,
            previous_metrics: emptyMetrics,
            changes: emptyChanges,
          },
        ],
      },
    ],
  }
}

describe('admin model performance helpers', () => {
  test('builds expandable group rows without losing disabled group state', () => {
    const rows = buildAdminPerformanceRows(performanceData())

    assert.equal(rows.length, 1)
    assert.deepEqual(rows[0].group_names, ['default'])
    assert.equal(rows[0].children?.length, 1)
    assert.equal(rows[0].children?.[0].kind, 'group')
    assert.equal(rows[0].children?.[0].enabled, false)
  })

  test('prioritizes errors before empty data and distinguishes disabled metrics', () => {
    assert.equal(
      getAdminPerformanceDisplayState({
        loading: false,
        error: true,
        hasData: false,
        rowCount: 0,
      }),
      'error'
    )
    assert.equal(
      getAdminPerformanceDisplayState({
        loading: false,
        error: false,
        hasData: true,
        metricsEnabled: false,
        hasCompleteBuckets: true,
        rowCount: 1,
      }),
      'disabled'
    )
  })
})
