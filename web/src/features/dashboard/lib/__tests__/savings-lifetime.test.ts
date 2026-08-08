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

import type { SavingsLifetimeSummary } from '../../types.ts'
import {
  formatSavingsPercent,
  getLifetimeSavingsViewState,
} from '../savings.ts'

function createSummary(
  overrides: Partial<SavingsLifetimeSummary> = {}
): SavingsLifetimeSummary {
  return {
    enabled: true,
    show_on_dashboard: true,
    show_on_wallet: true,
    currency: 'CNY',
    savings_cny_micros: '1000000',
    savings_quota: '1',
    official_quota: '2',
    actual_quota: '1',
    request_count: 10,
    estimated_request_count: 8,
    snapshot_request_count: 8,
    reconstructed_request_count: 0,
    coverage_ratio: 0.8,
    statistics_started_at: 1_700_000_000,
    last_aggregated_at: 1_700_000_100,
    backfill_status: 'completed',
    backfill_progress: 1,
    is_complete: true,
    ...overrides,
  }
}

describe('getLifetimeSavingsViewState', () => {
  it('uses failure before empty and incomplete states', () => {
    assert.equal(
      getLifetimeSavingsViewState(
        createSummary({
          backfill_status: 'failed',
          request_count: 0,
          is_complete: false,
        })
      ),
      'failed'
    )
  })

  it('distinguishes empty totals from completed totals without estimates', () => {
    assert.equal(
      getLifetimeSavingsViewState(createSummary({ request_count: 0 })),
      'empty'
    )
    assert.equal(
      getLifetimeSavingsViewState(
        createSummary({ estimated_request_count: 0 })
      ),
      'no_estimates'
    )
  })

  it('keeps globally incomplete totals in a non-final state', () => {
    assert.equal(
      getLifetimeSavingsViewState(
        createSummary({
          is_complete: false,
          backfill_status: 'completed',
          backfill_progress: 1,
        })
      ),
      'processing'
    )
    assert.equal(
      getLifetimeSavingsViewState(
        createSummary({ is_complete: false, backfill_status: 'paused' })
      ),
      'paused'
    )
  })
})

describe('formatSavingsPercent', () => {
  it('formats valid ratios and rejects invalid values', () => {
    assert.equal(formatSavingsPercent(0.823, 'zh-CN'), '82%')
    assert.equal(formatSavingsPercent(0.823, 'zh-CN', 1), '82.3%')
    assert.equal(formatSavingsPercent(Number.NaN, 'zh-CN'), '-')
    assert.equal(formatSavingsPercent(1.1, 'zh-CN'), '-')
  })
})
